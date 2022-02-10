//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 리퀘스트 받은 사용자가, (참여했고, 완료되었는데) 아직 열람하지 않은 게임의 개수를 리스폰스하는 람다
//
//
// 2021.12.24. sjjo. Initial. 기존에 작성해 놓은데서 갖다쓰니 편하다!
// 
// 2021.12.27. sjjo. 기존 겟마이게임리스트 에서 언씬 정보 같이 보여줄려고 했는데, 잘 안되서, 여기서 그냥 리스트 주는걸로.
//                   프론트에서 값 비교해서 좀 표시해줘요~ NEW 로~
//
//-------------------------------------------------------------------------------------
// 
// [References]
// *. 카운트 쿼리 결과값을, 읽어서 사용하기. https://pythonq.com/so/mysql/280172
// 
// 
//-------------------------------------------------------------------------------------

'use strict';
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
          const errMsg = "[GetMyUnseenCountV2] [ERROR]: db-error:" + err;
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
      if(status == 200)
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
      if(status == 200)
      {
        return response;
      }else
      {
        //throw new Error(response);
        throw new Error(JSON.stringify(response));
      }      
  }  
};

module.exports.GetMyUnseenCountV2 = async (event) => {

  //-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------
  if( (event.userIdx==null) )
  {
    const err_msg = "[GetMyUnseenCountV2] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  // 리퀘스트온 사용자의 idx를 저장하고, (가독성과 사용의 편리를 위해)
  const intUserIdx = event.userIdx;
  var queryResult = null; 

  //-------------------------------------------------------------------------
  // 1. 푸울을 사용해서 쿼리. 
  //
  //-------------------------------------------------------------------------
  try{

    //const queryStrUnseenCount = 'SELECT COUNT(gameIdx) FROM UnseenTable WHERE userIdx=' + intUserIdx + ';';
    //const queryStrUnseenCount = 'SELECT gameIdx FROM UnseenTable WHERE userIdx=' + intUserIdx + ';';

    /*
    // Ref. 카운트 쿼리 결과값을, 읽어서 사용하기. https://pythonq.com/so/mysql/280172
    const queryStrUnseenCount = 'SELECT COUNT(gameIdx) AS unseenCnt FROM UnseenTable WHERE userIdx=' + intUserIdx + ';';

    queryResult = await queryThisFromTheTable(queryStrUnseenCount);

    //console.logDebug(queryResult);

    //console.logDebug(queryResult[0].COUNT(gameIdx) );
    //console.logDebug(queryResult[0].'COUNT(gameIdx)' );
    //console.logDebug(queryResult[0].unseenCnt);


    const return_body = {
      userIdx: intUserIdx, 
      numOfUnseenGames: queryResult[0].unseenCnt
    };
    */

    // 2021.12.27
    const queryStrUnseenCount = 'SELECT gameIdx FROM UnseenTable WHERE userIdx=' + intUserIdx + ';';

    queryResult = await queryThisFromTheTable(queryStrUnseenCount);

    const numOfResult = queryResult.length;

    const return_body = {
      userIdx: intUserIdx, 
      numOfUnseenGames: numOfResult,
      unseenGameList: queryResult
    };


    console.logDebug("[GetMyUnseenCountV2] userIdx: " + intUserIdx +", numOfUnseenGames: " + numOfResult);

    return sendRes(200, return_body);

  }catch(error)
  {
    const errMsg = "[GetMyUnseenCountV2] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error;
    console.log(errMsg);
    return sendRes(400, errMsg);
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
