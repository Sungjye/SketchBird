//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 리퀘스트 받은 사용자가, 아직 열람하지 않은 게임을, 열람했다고 클리어(언씬 테이블에서 지워주는) 람다
//
//
// 2021.12.24. sjjo. Initial. 기존에 작성해 놓은데서 갖다쓰니 편하다!
// 
//
//-------------------------------------------------------------------------------------
// 
// [References]
// 
// 
//-------------------------------------------------------------------------------------

'use strict';

const ERR_ABNORMAL_QUERY = 1;
const ERR_WARNING_AFTERQUERY = 2;

// 로그 안 찍히게 하기. 
console.logDebug = function() {};

/*
// 로그 찍히게 하기.
var log = console.log;
console.logDebug = function() {
  log.apply(console, arguments);
  // Print the stack trace
  //console.trace();
};
*/


// get the client
const mysql = require('mysql2');
//const mysql = require('mysql2/promise');

// Create the connection pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
  host: 'sketchbird-01.c8wfnhiunwfj.ap-northeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'sketchbirddb',
  password: 'coglix!!..',
  database: 'sketchbird',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});



async function queryThisFromTheTable( query_str ){
  return new Promise( (resolve, reject) => {

    pool.query(query_str, function(err, result, fields) {
      if(result)
      {
          resolve(result);
      }
      if(err)
      {
          const errMsg = "[ClearMyUnseenGamesV2] [ERROR]: db-error:" + err;
          console.log(errMsg);
          reject(errMsg);
      }

      // Connection is automatically released when query resolves
      // https://www.npmjs.com/package/mysql2
      // 쿼리가 리졸브 되면 자동 릴리즈 된단다.. 흠..
    });

  }
  );
}
/* 위의 코드가 나중에라도 문제되면 이 코드 참고해서 바꿔보자. 2021.11.30
// https://www.npmjs.com/package/mysql2
Alternatively, there is also the possibility of manually acquiring a connection from the pool and returning it later:

// For pool initialization, see above
pool.getConnection(function(err, conn) {
   // Do something with the connection
   conn.query( ... );
   // Don't forget to release the connection when finished!
   pool.releaseConnection(conn);
})
*/


const isLocal = 0; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
//
const sendRes = (status, rcv_body) => {
  let response=null;

  if( isLocal==0 )
  {
      response = {
          statusCode: status,
          headers: {
              "Content-Type" : "application/json",
              "Access-Control-Allow-Headers" : "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
              "Access-Control-Allow-Methods" : "OPTIONS,POST,PUT",
              "Access-Control-Allow-Credentials" : true,
              "Access-Control-Allow-Origin" : "*",
              "X-Requested-With" : "*"
          },
          body: rcv_body
      };
      // return response;
      // 정상 리스폰스가 아니면 에러를 쓰로우. 
      //if(status == 200)
      if( (status >= 200) && (status < 300) )
      {
        return response;
      }else
      {
        //throw new Error(response);
        throw new Error(JSON.stringify(response));
      }

  }else
  {
      // 이거!! CLI sls local 인 경우, 이거 해줘야 에러 안나고 실행된다. 
      // rcv_body는 사실상 JSON 인데. 
      // 뭔가 잘 이해는 안되지만, 실험적으로, 이렇게 해서 동작하게. 2021.08.17
      //var str_body = rcv_body;
      var str_body = JSON.stringify(rcv_body);

      response = {
        statusCode: status,
        headers: {
            "Content-Type" : "application/json",
            "Access-Control-Allow-Headers" : "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods" : "OPTIONS,POST,PUT",
            "Access-Control-Allow-Credentials" : true,
            "Access-Control-Allow-Origin" : "*",
            "X-Requested-With" : "*"
        },
        body: str_body
      };

      // 정상 리스폰스가 아니면 에러를 쓰로우. 
      //if(status == 200)
      if( (status >= 200) && (status < 300) )
      {
        return response;
      }else
      {
        //throw new Error(response);
        throw new Error(JSON.stringify(response));
      }      
  }  
};

module.exports.ClearMyUnseenGamesV2 = async (event) => {

  //-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------
  if( (event.userIdx==null) || (event.gameIdx==null) )
  {
    const err_msg = "[ClearMyUnseenGamesV2] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  // 리퀘스트온 사용자의 idx를 저장하고, (가독성과 사용의 편리를 위해)
  const intUserIdx = event.userIdx;
  const intGameIdx = event.gameIdx;
  var queryResult = null; 

  let response_msg = null;
  //-------------------------------------------------------------------------
  // 1. 푸울을 사용해서 쿼리. 
  //
  //-------------------------------------------------------------------------
  try{

    
    // 괄호 안하면 큰일남!
    const deleteStrUnseenGame = 'DELETE FROM UnseenTable WHERE (userIdx=' + intUserIdx + ' ' + 'AND' + ' ' + 'gameIdx=' + intGameIdx +');';

    queryResult = await queryThisFromTheTable(deleteStrUnseenGame);

    console.logDebug(queryResult.warningStatus);

    console.logDebug(queryResult.affectedRows);


    if( (queryResult.affectedRows == 1) && (queryResult.warningStatus == 0) ) 
    {
      response_msg = "Clearing the unseen game for this user is successful.";

      const return_body = {
        userIdx: intUserIdx, 
        gameIdx: intGameIdx,
        result: 1,
        message: response_msg
      };
    
      //console.logDebug("[ClearMyUnseenGamesV2] userIdx: " + intUserIdx +", gameIdx: " + intGameIdx);
    
      return sendRes(200, return_body);

    }
    else if( (queryResult.affectedRows == 0) && (queryResult.warningStatus == 0) ) 
    {
      response_msg = "Well, There is no game of the index to clear for this user!";

      const return_body = {
        userIdx: intUserIdx, 
        gameIdx: intGameIdx,
        result: 1,
        message: response_msg
      };
    
      //console.logDebug("[ClearMyUnseenGamesV2] userIdx: " + intUserIdx +", gameIdx: " + intGameIdx);
    
      return sendRes(202, return_body);

    }
    else if( (queryResult.warningStatus != 0) ) throw ERR_WARNING_AFTERQUERY;     
    else throw ERR_ABNORMAL_QUERY;

    

  }catch(error)
  {
    let errMsg = null;
    
    if(error == ERR_ABNORMAL_QUERY) errMsg = "[ClearMyUnseenGamesV2] [Error] Abnormal query string! :  " + " > " + error;
    else if(error == ERR_WARNING_AFTERQUERY) errMsg = "[ClearMyUnseenGamesV2] [Error] Warning is occured after the querying! :  " + " > " + error;
    else errMsg = "[ClearMyUnseenGamesV2] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error;
        
    
    console.log(errMsg);
    return sendRes(400, errMsg);
  }




  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};

