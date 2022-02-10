//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
//
// 다음을 쿼리로 받아서, 제시어 몇개를 랜덤으로 DynamoDB에서 get 할때 대응하는 람다함수.
// S: tablename (~dynamoDB~ mysql에서의 테이블이름)
// S: numberof (랜덤으로 받는 개수)
//
// 2021.07.21. sjjo. 초기작성. handover_get_words_03 람다에서 가져옴. yoon 작성 코드에서 가져옴.
//
// [쿼리문]
//

'use strict';

const mysql = require('mysql');

// 필요시 나중에 event로 받기. 
const nNumOfRandomWords = 5;

//-------------------------------------------------------
// MYSQL 테이블에서 랜덤하게 특정 개수를 가져오는 함수
// 일단 간단히 이렇게 하지만, 
// 출시전에는 1000개 이상 될 것이므로, 아래 링크들 보고,
// 쿼리문이든 뭐든 새로 만져야 한다! 2021.07.21. sjjo.
// https://stackoverflow.com/questions/4329396/mysql-select-10-random-rows-from-600k-rows-fast
// http://jan.kneschke.de/projects/mysql/order-by-rand/
// 
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


// MYSQL 테이블에서 데이터를 5개 조회하는 예제
function getCommentByDB() {
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
    //'select id, hit from posts where subject="aaa"'
    // 'select * from posts'
    mysql_connection.query('SELECT subject FROM posts WHERE id IN (6,7)', function(err, result, field) {
        if(result)
          resolve(result);
        
        if(err)
          console.log("db-error:",err);
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


module.exports.get_words = async (event, context) => {

  /*
  const mysqlResult = await getCommentByDB();
  console.log(mysqlResult);

  //console.log(mysqlResult.subject[0]); // error
  //console.log(mysqlResult[0].RowDataPacket); // undefined
  //console.log(mysqlResult.RowDataPacket[0]); // error
  //@ console.log(mysqlResult[0]); // OK. first row.
  //console.log(mysqlResult[0].RowDataPacket.subject); // error. Cannot read property 'subject of undefined.
  //@ console.log(mysqlResult[0].subject); // OK! Linear Algebra.
  console.log(mysqlResult[0].subject);


  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Get random keywords! Your function executed successfully!',
        input: event,
        result: mysqlResult,
      },
      null,
      2
    ),
  };
  */


  try{

    var aWordList = new Array();

    const mysqlResult = await getRandomWordsFromDB();

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

    console.log("[get_words] Get Random Words: [Error][Failed]:  " + " > " + error);
    return sendRes(400, error);

  }



  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
