/*
Required Libraries 
*/
var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var async = require('async');
var fs = require('fs'); // file system 
var email = require('emailjs');
var cronJob = require('cron').CronJob;
var config = require('./config');
var app = express();

var server = email.server.connect({
  user: config.email.user,
  password: config.email.password,
  host: config.email.host,
  ssl: true
});

var WebScraper = (function() {
  var article = {
    context: "",
    name: "no name",
    links: [],
    date: ""
  };   
  var sendEmail = function() {
    console.log(article.context);
    fs.writeFile('./'+article.name,article.context,function(err) {
      if (err) return console.log(err);
	    server.send({
			  text: "attached articles :)",
			  from: config.email.from,
			  to: config.email.to, 
			  subject: "Scarper Result",
			  attachment:{path:"./"+article.name,type:"text/plain",name:article.name}
		  },function(err, message) { 
			  console.log(err || message);
		  });
	  });
	  article.date = new Date().toString();	
  };			
  var fetchTargets = function() {
  	// clear the context and links 
  	var article.context = "";
  	var article.links = [];
  	
   	var todayDate = new Date();
		var fileName = todayDate.getMonth()+1 +"-"+todayDate.getDate()+".txt";
		article.name = fileName;
    
    // fetch links   
    request({ uri: 'http://mainichi.jp/feature/maisho/' }, function (error, response, body) {
      if (error && response.statusCode !== 200) {
        console.log('Error when trying to contact target website')
      }   
      $ = cheerio.load(body);
      async.series([
      function(callback){
        $(".MaiLink").first().find("li a").each(function(index,element){
          article.links.push($(this).attr("href"));
        });
        callback(null,"done");                  
      },
      function(callback) {
        var orgCallback = callback;         
        async.eachSeries(article.links,function(item,callback){
          // fetch context of the list of links 
          request({ uri: item }, function (error, response, body) {
            if (error && response.statusCode !== 200) {
              console.log('Error when contacting target');
            }
            $ = cheerio.load(body);
            article.context = article.context + "===================================================== \r \n" +  $("h1.NewsTitle").text() + '\r\n' +$("p.Credit").text() + '\r\n' + $("div.NewsBody").text() + '\r\n';
              callback();
          });
        },function() {
          sendEmail();
          orgCallback(null,"done");
        });
      }
      ],function(err,results) {
        //call back         
        return "done"
      });
    });
  };   
  return {
    article:article,
    fetch:fetchTargets
  };

})();

var job = new cronJob('0 45 21 * * *', function(){
  WebScraper.fetch()
});

job.start();

app.get('/status', function(req, res) {
	res.send(WebScraper.article);
});
app.listen(3000);


