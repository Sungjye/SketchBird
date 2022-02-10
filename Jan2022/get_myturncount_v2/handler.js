//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 리퀘스트 받은 사용자가 해야할 차례인 게임의 개수를 리스폰스하는 람다
//
// 
// 2021.10.14. sjjo. Initial.
// 2021.10.19. sjjo. 해야할 게임의 개수만 돌려주는 걸로 변경. 
// 2021.11.16. sjjo. (그냥) 해당하는 사용자의 인덱스도 같이 리스폰스 해줌. 에러처리 추가. 
// 2021.11.16. sjjo. 함수 이름을 game에서 count로 바꿈. 
// 
// 2021.11.30. sjjo. 다음 문제 관련해서 JY 레퍼와, 주의 도우심으로 이렇게 진행. 
//                   AWS Lambda Error: Quit inactivity timeout at Quit
//                   Error: Runtime exited with error: exit status 129
// 2021.12.14. sjjo. 비용 절감?과 성능 향상? 을 위해, 정상적인 경우의 로그 코드 없애는 오버라이드 함수 작성. 
// 
//
//-------------------------------------------------------------------------------------
// References.
// * mysql pool 개념 적용. 
// https://cotak.tistory.com/104  
// https://www.npmjs.com/package/mysql2
// 주시는 마음을 따라, 이것 찬찬히 읽고, 크롬에서 따라 해보고 다시 돌아왔다. 
// https://programmingsummaries.tistory.com/325
// 
// * 콘솔 닷 로그 오버라이드
// https://stackoverflow.com/questions/45395369/how-to-get-console-log-line-numbers-shown-in-nodejs
// https://stackoverflow.com/questions/1215392/how-to-quickly-and-conveniently-disable-all-console-log-statements-in-my-code
// 
// 
//-------------------------------------------------------------------------------------


'use strict';

// 로그 안 찍히게 하기. 
console.logDebug = function() {};
/*
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



async function queryTest( query_str ){
  return new Promise( (resolve, reject) => {

    pool.query(query_str, function(err, result, fields) {
      if(result)
      {
          resolve(result);
      }
      if(err)
      {
          const errMsg = "[GetMyturnCountV2] [ERROR]: db-error:" + err;
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

module.exports.GetMyturnCountV2 = async (event) => {

  //-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------
  if( (event.userIdx==null) )
  {
    const err_msg = "[GetMyturnCountV2] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
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
    const testStr = "SELECT gameIdx FROM GameCurrentTable WHERE nextUserIdx=" + intUserIdx + ';'; // 개수만 알면 되므로.
    queryResult = await queryTest(testStr);

    const intResultNum = queryResult.length;


    const return_body = {
      userIdx: intUserIdx, 
      numOfGames: intResultNum
    };

    // for test. 2021.12.14
    //console.log("[GetMyturnCountV2] userIdx: " + intUserIdx +", numOfGames: " + intResultNum);
    console.logDebug("[GetMyturnCountV2] userIdx: " + intUserIdx +", numOfGames: " + intResultNum);
    

    return sendRes(200, return_body);

  }catch(error)
  {
    const errMsg = "[GetMyturnCountV2] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error;
    console.log(errMsg);
    return sendRes(400, errMsg);
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
