/*
Required Libraries 
*/
var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
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
    fs.writeFile('./'+article.name,article.context,function(err) {
      if (err) return console.log(err);
	    server.send({
			  text: "attached articles :)",
			  from: config.email.from,
			  to: config.email.to, 
			  subject: "Scraper Result",
			  attachment:{path:"./"+article.name,type:"text/plain",name:article.name}
		  },function(err, message) { 
			  console.log(err || message);
		  });
	  });
	  article.date = new Date().toString();	
  };			

  var fetchTargets = function() {

    // clear out cache 
    article.context = "";
    article.links = [];

   	var todayDate = new Date();
		var fileName = todayDate.getMonth()+1 +"-"+todayDate.getDate()+".txt";
		article.name = fileName;
    console.log(fileName);    

    request({ uri: 'http://mainichi.jp/feature/maisho/' }, function (error, response, body) {
      if (error && response.statusCode !== 200) {
        console.log('Error when trying to contact target website')
      }   
      $ = cheerio.load(body);
      // fetch link and article content
      var $links = $(".MaiLink").first().find("li a");
      var numOfLinks =  $links.length;
      $links.each(function(index,element){
        var lastLink = ((numOfLinks - 1) == index)? true : false;            
        var linkAddr = $(this).attr("href");            
        article.links.push(linkAddr); 
        request({ uri: linkAddr }, function (error, response, body) {
          if (error && response.statusCode !== 200) {
            console.log('Error when contacting target');
          }
          $ = cheerio.load(body);
          article.context = article.context + "===================================================== \r \n" +  $("h1.NewsTitle").text() + '\r\n' +$("p.Credit").text() + '\r\n' + $("div.NewsBody").text() + '\r\n';
          if(lastLink === true){
            WebScraper.sendEmail();                
          }
        });
      });
    });
  };   
  return {
    article:article,
    fetch:fetchTargets,
    sendEmail: sendEmail
  };

})();

var job = new cronJob('0 16 18 * * *', function(){
  WebScraper.fetch()
});

job.start();

app.get('/status', function(req, res) {
	res.send(WebScraper.article);
});

app.get('/trigger', function(req, res) {
  WebScraper.fetch();
	res.send(WebScraper.article);
});


app.listen(3000);


