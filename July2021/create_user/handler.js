//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자의 데이터를 새롭게 생성하는 람다
//
// 
// 2021.07.28. sjjo. 새롭게 rds로.. 힘내자!
//
//-------------------------------------------------------------------------------------


'use strict';

const mysql = require('mysql');


const nNumOfRandomWords = 5;


function getRandomWordsFromDB() {
  return new Promise((resolve, reject) => {
    // Mysql
    const mysql_connection = mysql.createConnection({
    host: 'sketchbird-01.c8wfnhiunwfj.ap-northeast-2.rds.amazonaws.com',
    port: 3306,
    user: 'sketchbirddb',
    password: 'coglix!!..',
    database: 'sketchbird'
    });

    mysql_connection.connect();

    var strQueryString = 'SELECT subject FROM posts ORDER BY RAND() LIMIT ' + nNumOfRandomWords.toString();
    //'select id, hit from posts where subject="aaa"'
    // 'select * from posts'
    mysql_connection.query(strQueryString, function(err, result, field) {
        if(result)
          resolve(result);
        
        if(err)
          console.log("get_words: [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}


`UserIdx` int unsigned NOT NULL AUTO_INCREMENT,
`UserUid` varchar(45) NOT NULL,
`FcmToken` tinytext NOT NULL,
`NickName` varchar(45) NOT NULL,
`AgeRange` int DEFAULT NULL,
`Region` varchar(45) DEFAULT NULL,
`AccepJorugi` tinyint NOT NULL,
`AcceptRandom` tinyint NOT NULL,
`IsBlockedUser` tinyint NOT NULL,





function insertUserToDB() {
  return new Promise( (resolve, reject) => {
    const mysql_connection = mysql.createConnection({
      host: 'sketchbird-01.c8wfnhiunwfj.ap-northeast-2.rds.amazonaws.com',
      port: 3306,
      user: 'sketchbirddb',
      password: 'coglix!!..',
      database: 'sketchbird'      
    });

    mysql_connection.connect();

    var strQueryString = 'SELECT subject FROM posts ORDER BY RAND() LIMIT ' + nNumOfRandomWords.toString();
    
    mysql_connection.query( strQueryString, function(err, result, field) {
      if(result){
        resolve(result);
      } 

      if(err){
        console.log("create user: [ERROR]: db-error", err);
        reject(err);
      } 
    });

    mysql_connection.end();

  });
}


// 표준 response 를 보내기 위해. 
const sendRes = (status, body) => {
  var response = {
      statusCode: status,
      headers: {
          "Content-Type" : "application/json",
          "Access-Control-Allow-Headers" : "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
          "Access-Control-Allow-Methods" : "OPTIONS,POST,PUT",
          "Access-Control-Allow-Credentials" : true,
          "Access-Control-Allow-Origin" : "*",
          "X-Requested-With" : "*"
      },
      body: body
  };
  return response;
};


module.exports.CreateUser = async (event) => {

  try{

    var aWordList = new Array();

    //const mysqlResult = await getRandomWordsFromDB();
    const mysqlResult = await insertUserToDB();

    mysqlResult.forEach( function(item) {

      //console.log(item.subject);
      aWordList.push(item.subject);
      
    });

    //@ console.log(mysqlResult[0]); // OK. first row.
    //@ console.log(mysqlResult[0].subject); // OK! Linear Algebra.

    //return mysqlResult[0].subject;
    //return aWordList;

    return {
      "keywords":
      {
        "words": aWordList
      }
    }

  }catch(error){

    console.log("[CreateUser] test: [Error][Failed]:  " + " > " + error);
    return sendRes(400, error);

  }

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
