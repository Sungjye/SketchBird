//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자의 Uid와 OriginSNS를 받아서, 
// (앱에서 계속 사용할) (mysql db에서의) 사용자 인덱스 (int) 를 response 해 주는 람다.
//
// Request: 
//    POST
//    {
//      "UserUid": "12345", 
//      "OriginSNS": "kakao"
//    }
// 
// Reponse:
//    {
//      "UserIdx": 1
//    }
//
// 2021.08.09. sjjo. 
//
//-------------------------------------------------------------------------------------

'use strict';

const mysql = require('mysql');
const table_name = 'UserTable';



function queryThisFromTheTable(query_string) {
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

    //var strQueryString = 'SELECT subject FROM posts ORDER BY RAND() LIMIT ' + nNumOfRandomWords.toString();
    //'select id, hit from posts where subject="aaa"'
    // 'select * from posts'
    mysql_connection.query(query_string, function(err, result, field) {
        if(result)
          resolve(result);
        
        if(err)
          console.log("[RetrieveUserIdx]: [ERROR]: db-error:",err);
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

module.exports.RetrieveUserIdx = async (event) => {

  if(event.OriginSNS == null) console.log("OriginSNS is null.");
  
  if(event.OriginSNS != null) console.log("OriginSNS is NOT null.");


  try{
    //-------------------------------------------------------------------------
    // STEP 1. 쿼리 문을 만들고,
    var strQueryString = 'SELECT UserIdx FROM ' + table_name + ' ' 
                              + 'WHERE UserUid=' + '\'' + event.UserUid + '\' ' + 'AND '
                                    + 'OriginSNS=' + '\'' + event.OriginSNS + '\';'; // 스트링이라 '를 넣어줘야 쿼리됨!

    

    //-------------------------------------------------------------------------
    // STEP 2. DB 접근하고,
    const mysqlResult = await queryThisFromTheTable(strQueryString);


    //-------------------------------------------------------------------------
    // STEP 3. 예외 처리.
    // 만약 같은 조건의 사용자 row 가 1개 이상이라면, 앱단에서 처리 오류 등으로 인해
    // 동일한 사용자가 1명이상 UserTable에 기록된 것이므로
    // error 를 리턴한다. 
    var numOfUser = 0;
    mysqlResult.forEach( function(item){
      numOfUser++;
    });
    if( numOfUser > 1) // 동일 사용자가 2 row 이상 있는 경우. 이전에 CreateUser 가 중복 수행되었음
    {
      //console.log("[RetrieveUserIdx] [Error][Failed]:  " + " > " + "More than 1 User!!!");
      var strErrMsg = "[RetrieveUserIdx] [Error][Failed]:  " + " > " + "More than 1 User!!!  " + numOfUser.toString() + " Users for " + event.UserUid;
      //console.log(strErrMsg);
      return sendRes(410, JSON.stringify(strErrMsg) );
    }
    if( numOfUser == 0) // 사용자가 없는 경우. 
    {
      //console.log("[RetrieveUserIdx] [Error][Failed]:  " + " > " + "More than 1 User!!!");
      var strErrMsg = "[RetrieveUserIdx] [Error][Failed]:  " + " > " + "There is no such a User!!!  " + numOfUser.toString() + " Users for " + event.UserUid
                                                            + " from OriginSNS: " + event.OriginSNS;
      //console.log(strErrMsg);
      return sendRes(420, JSON.stringify(strErrMsg) );
    }
    

    //-------------------------------------------------------------------------
    // STEP 4. 성공적으로 1명의 사용자 정보를 가져온 경우. 
    console.log("[RetrieveUserIdx] [OK] Retrieved UserIdx: " + mysqlResult[0].UserIdx);
    //XX console.log("[RetrieveUserIdx] Last insert id: UserIdx: " + mysqlResult);
    return sendRes(200, JSON.stringify(mysqlResult[0])); 
  

  }catch(error){

    //-------------------------------------------------------------------------
    // STEP 5. 에러 처리.
    console.log("[RetrieveUserIdx] [Error][Failed]:  " + " > " + error);
    return sendRes(400, error);

  }



/*
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v1.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  };

*/  

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
