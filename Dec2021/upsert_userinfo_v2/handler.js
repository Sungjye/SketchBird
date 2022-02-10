//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 기존에 사용자 없으면 인서트, 있으면 업데이트 하는 람다. 
// 사용자 정보는 언제나 풀셋으로 옴을 가정함. 
//
// 
// 2021.10.28. sjjo. Initial. JY 요청으로 만듬.
// 2021.11.05. sjjo. 첫 deploy.
//
// 2021.12.17. sjjo. 기존의 v1을 v2로 변경. pool 방식으로 변경.
// 
//-------------------------------------------------------------------------------------

'use strict';


// 로그 안 찍히게 하기. 
//console.logDebug = function() {};

var log = console.log;
console.logDebug = function() {
  log.apply(console, arguments);
  // Print the stack trace
  //console.trace();
};

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
          const errMsg = "[UpsertUserInfoV2] [ERROR]: db-error:" + err;
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



//---------------------------------------------------------------------
// 표준 response 를 보내기 위해. + 에러 리스폰스 처리를 합침.
// : 기존 sendRes와 sendErr를 합침. 
//    * AWS Lambda 에 deploy 후에 실행시, response 에 \ 붙는 문제 해결 관련해서
//      body의 형식을 나눔. 정말 생고생했다.. 이런거 때매.. 
//    * error 를 쓰로우 해야, http response 가 해당 코드대로 제대로 간다 .
//    * feat. JY ref: https://dikshit18.medium.com/mapping-api-gateway-with-lambda-output-e8ea9e435bbf 
//---------------------------------------------------------------------
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

module.exports.UpsertUserInfoV2 = async (event) => {


  //-------------------------------------------------------------------------
  // 0. 넘어온 값중, 사용자유아이디와, 오리진에센에스가 널임?...
  //-------------------------------------------------------------------------
    if( (event.userUid == null) || (event.originSNS == null) )
    {
      const strInfoMsg = '[UpsertUserInfoV2] [Error] Null data!!!: ' 
                            +'userUid: ' + event.userUid
                            +'originSNS: ' + event.originSNS;
      console.log(strInfoMsg);
      return sendRes(402, strInfoMsg);
    
    }  
  // 한꺼번에 다 넘어 온다네.. 
  // 그럼 한꺼번에 한문장으로 가능. 
  
  //-------------------------------------------------------------------------
  // 1. 다른 파라메터 다 있음? 없으면 412 날림. 
  //-------------------------------------------------------------------------
  if( (event.fcmToken == null) || // 1
      (event.nickName == null) || // 2  
      (event.ageRange == null) || // 3
      (event.gender == null) || // 4
      (event.region == null) || // 5
      (event.userLanguage == null) || // 6
      (event.acceptJorugi == null) || // 7
      (event.acceptRandom == null) || // 8
      (event.isBlockedUser == null) || // 9
      (event.funUserScore == null) || // 10
      (event.goldHandScore == null) || // 11
      (event.userLevel == null) || // 12
      (event.reporting == null) || // 13
      (event.reported == null) || // 14
      (event.agreeTerms == null) || // 15
      (event.useSound == null) || // 16
      (event.userLevelScore == null)    // 17
      // 원래는 최대, userIdx, signedUpTime, 에 userUid, originSNS 까지 해서 21개 까지 넘어올 수 있다?
  )
  {
    const strInfoMsg = '[UpsertUserInfoV2] [Error] There is/are NULL data!!!: ' 
    +'userUid: ' + event.userUid
    +'originSNS: ' + event.originSNS;
    console.log(strInfoMsg);
    return sendRes(412, strInfoMsg);  
  }
  
  //-------------------------------------------------------------------------
  // 1.5. 이 테이블 PK, AI 문제인지, 업서트 안되서, 나눠서 함. 
  //      이 사용자가 있는지 확인. 
  //-------------------------------------------------------------------------
  let numOfUser = null;
  const TABLE_NAME = 'UserTable';
  
  let retrievedUserIdx = null; // 인서트 또는 업데이트한 인덱스를 담기용. 
  let retrievedSignedUpTime = null;// 리스폰스할 때 GetUserInfo 할떄와 '완전히' 같은 형식으로 맞추어 줄 수 있게. 
  
  let response_body = null; // 업데이트, 인서트 경우에 따라 내용을 구성하는 방법이 달라지고 이것을 리스폰스. (쿼리한번 덜 할려구.)
  
  try{
  
      //const strQueryString = 'SELECT * FROM ' + TABLE_NAME + ' ' 
      const strQueryString = 'SELECT userIdx, signedUpTime FROM ' + TABLE_NAME + ' ' 
      + 'WHERE userUid=' + '\'' + event.userUid + '\' ' + 'AND '
            + 'originSNS=' + '\'' + event.originSNS + '\' '; // 스트링이라 '를 넣어줘야 쿼리됨! 
  
      const mysqlResult = await queryThisFromTheTable(strQueryString);
    
      numOfUser = mysqlResult.length;
  
      //console.log(numOfUser);
  
      if( numOfUser == 0 ) // 사용자가 없는 경우. 인서트할 각.
      {
        // 명수를 보고, 인서트 처리할 수 있게 에러 쓰로우 먼저 해야. 
        // 헐 이제 알았음. 셀렉트 결과가 0 이면, 에러로 캐치됨을. HERE 
        throw ERR_NO_VALID_USER_TO_UPDATE;
      }else if( numOfUser == 1 ) // 단 한명의 사용자가 있는 경우. 업데이트 할 각.
      {
        retrievedUserIdx = mysqlResult[0].userIdx; // 없으면 널 들어가겠지 에러 던지거나. 
        retrievedSignedUpTime = mysqlResult[0].signedUpTime;
  
      }else // 한 명 이상의 사용자가 있는 이상한 경우. 
      {
        throw ERR_MORE_THAN_ONE_USER;
      }
  
      
  
  }catch(error)
  {
    // 헐 이제 알았음. 셀렉트 결과가 0 이면, 에러로 캐치됨을. HERE 
    
    if(error == ERR_NO_VALID_USER_TO_UPDATE)
    {
      // 이 경우는 기존 사용자가 없으므로, 인서트로 넘어가야. 그래서 그냥 넘어감. 
      ;
    }else if(error == ERR_MORE_THAN_ONE_USER)
    {
      const strInfoMsg = "[UpsertUserInfoV2] [SERIOUS Error!!] [UserTable] There is/are more than one users! "
                          +'userUid: ' + event.userUid
                          +'originSNS: ' + event.originSNS;
      console.log(strInfoMsg);
      return sendRes(400, strInfoMsg);      
    }else
    {
      // 이 경우는 
      const strInfoMsg = "[UpsertUserInfoV2] [Error] [UserTable] SELECT FAIL. DB Access or etc.:  " + " > " + error;
      console.log(strInfoMsg);
      return sendRes(400, strInfoMsg);      
    }
  }
  
  
  //-------------------------------------------------------------------------
  // 2. 쿼리된 사용자의 수에 따라 처리. 인서트 or 업데이트
  //-------------------------------------------------------------------------
  if( numOfUser == 1) // 사용자가 1명 있고, 넘어온 데이터가 다 있어서, 업데이트 하는 경우.
  {
    // console.log("Update");
    
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
    // 정상적인 경우는 데이터 풀세트(GetUserInfo에서 오는것) 다온다고 하니, 
    // 그대로 업데이트하자. 널 체크는 위에서 했으니. 
  
    const strUpdateUserInfo = 'UPDATE ' + TABLE_NAME + ' '
                                      + 'SET '
                                      + 'fcmToken=' + '\'' + event.fcmToken + '\''
                                      + ', nickName=' + '\'' + event.nickName + '\''
                                      + ', ageRange=' + event.ageRange
                                      + ', gender=' + event.gender
                                      + ', region=' + '\'' + event.region + '\''
                                      + ', userLanguage=' + '\'' + event.userLanguage + '\''
                                      + ', acceptJorugi=' + event.acceptJorugi
                                      + ', acceptRandom=' + event.acceptRandom
                                      + ', isBlockedUser=' + event.isBlockedUser
                                      + ', funUserScore=' + event.funUserScore
                                      + ', goldHandScore=' + event.goldHandScore
                                      + ', userLevel=' + event.userLevel
                                      /*+ ', originSNS=' + event.*/
                                      /*+ ', signedUpTime'*/
                                      + ', reporting=' + event.reporting
                                      + ', reported=' + event.reported
                                      + ', agreeTerms=' + event.agreeTerms
                                      + ', useSound=' + event.useSound
                                      + ', userLevelScore=' + event.userLevelScore
                                      + ' ' + 'WHERE'
                                      + ' ' + 'userIdx=' + retrievedUserIdx
                                      + ';';
    
    //console.log(strUpdateUserInfo);
  
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
      // 디비 접근.
      try{
  
        const mysqlResult = await queryThisFromTheTable(strUpdateUserInfo);
  
        //console.log(mysqlResult);
  
        // 리스폰스 데이터를 구성한다. 업데이트 했으므로, 한번더 쿼리할 필요없다. 
        response_body = {
            userIdx: retrievedUserIdx, 
            userUid: event.userUid,
            fcmToken: event.fcmToken,
            nickName: event.nickName,
            ageRange: event.ageRange,
            gender: event.gender,
            region: event.region,
            userLanguage: event.userLanguage,
            acceptJorugi: event.acceptJorugi,
            acceptRandom: event.acceptRandom,
            isBlockedUser: event.isBlockedUser,
            funUserScore: event.funUserScore,
            goldHandScore: event.goldHandScore,
            userLevel: event.userLevel,
            originSNS: event.originSNS,
            signedUpTime: retrievedSignedUpTime,
            reporting: event.reporting,
            reported: event.reported,
            agreeTerms: event.agreeTerms,
            useSound: event.useSound,
            userLevelScore: event.userLevelScore
        };
  
  
      }catch(error)
      {
        const strInfoMsg = "[UpsertUserInfoV2] [Error] [UserTable] #UPDATE# FAIL. DB Access or etc.:  " + " > " + error;
        console.log(strInfoMsg);
        return sendRes(400, strInfoMsg);     
      }
  
      
  }else if( numOfUser == 0) // 사용자가 없고, 넘어온 데이터가 다 있어서, 인서트 하는 경우. 
  {
      //console.log("Insert");
  
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
      // 정상적인 경우는 데이터 풀세트(GetUserInfo에서 오는것) 다온다고 하니, 
      // 그대로 인서트 하자. 널 체크는 위에서 했으니. 
      const strInsertUserInfo ='INSERT INTO ' + TABLE_NAME + ' '
                                          +'(' /* userIdx는 자동증가 */
                                          + 'userUid'
                                          + ', fcmToken'
                                          + ', nickName'
                                          + ', ageRange'
                                          + ', gender'
                                          + ', region'
                                          + ', userLanguage'
                                          + ', acceptJorugi'
                                          + ', acceptRandom'
                                          + ', isBlockedUser'
                                          + ', funUserScore'
                                          + ', goldHandScore'
                                          + ', userLevel'
                                          + ', originSNS'
                                          + ', signedUpTime'
                                          + ', reporting'
                                          + ', reported'
                                          + ', agreeTerms'
                                          + ', useSound'
                                          + ', userLevelScore'
                                          + ') '
  
                                          +'VALUES (' 
                                          +   '\'' + event.userUid + '\''
                                          + ', \'' + event.fcmToken + '\''
                                          + ', \'' + event.nickName + '\''
                                          + ', ' + event.ageRange
                                          + ', ' + event.gender
                                          + ', \'' + event.region + '\''
                                          + ', \'' + event.userLanguage + '\''
                                          + ', ' + event.acceptJorugi
                                          + ', ' + event.acceptRandom
                                          + ', ' + event.isBlockedUser
                                          + ', ' + event.funUserScore
                                          + ', ' + event.goldHandScore
                                          + ', ' + event.userLevel
                                          + ', \'' + event.originSNS + '\''
                                          + ', Now()' 
                                          + ', ' + event.reporting
                                          + ', ' + event.reported
                                          + ', ' + event.agreeTerms
                                          + ', ' + event.useSound
                                          + ', ' + event.userLevelScore
                                          + ');' ;
  
      //console.log(strInsertUserInfo);
  
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
      // 디비 접근: 인서트 하기위해.
      let insertedUserIdx = null;
      try{
  
        const mysqlResult = await queryThisFromTheTable(strInsertUserInfo);
  
        //console.log(mysqlResult);
        insertedUserIdx = mysqlResult.insertId;      
  
  
      }catch(error)
      {
        const strInfoMsg = "[UpsertUserInfoV2] [Error] [UserTable] #INSERT# FAIL. DB Access or etc.:  " + " > " + error;
        console.log(strInfoMsg);
        return sendRes(400, strInfoMsg);     
      }
  
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
      // 디비 접근: 셀렉트 하기위해.
      // 인서트하고나서, 리스폰스해줄 때는, 사인업 타임 알아야 해서, 어쩔수 없이 쿼리 한번더 해야 한다. 
      const strQueryString = 'SELECT * FROM ' + TABLE_NAME + ' ' 
                                      + 'WHERE userIdx=' + insertedUserIdx + ';';
  
      try{
  
        const mysqlResult = await queryThisFromTheTable(strQueryString);
  
        //console.log(mysqlResult);
        response_body = mysqlResult[0];
  
  
      }catch(error)
      {
        const strInfoMsg = "[UpsertUserInfoV2] [Error] [UserTable] SELECT FAIL after INSERT. DB Access or etc.:  " + " > " + error;
        console.log(strInfoMsg);
        return sendRes(400, strInfoMsg);     
      }    
  
  
  }else
  {
    // 이건 한명이상의 사용자가 있는 이상한 경우. 위에서 처리되었겠지만, 혹시나. 
    const strInfoMsg = "[UpsertUserInfoV2] [SERIOUS Error!!] [UserTable] There is/are more than one users! "
                        +'userUid: ' + event.userUid
                        +'originSNS: ' + event.originSNS;
    console.log(strInfoMsg);
    sendRes(400, strInfoMsg);      
  }
  
  
  //-------------------------------------------------------------------------
  // 여기 까지 에러 안걸리고 왔으면, 업데이트든, 인서트 후 셀렉트든 성공한거니,
  // 최종 결과 리스폰스. 끝!
  //-------------------------------------------------------------------------
  return sendRes(200, response_body);
  
  /*
  업데이트한 경우 (1개 컬럼 업데이트, 데이터 변화 있을 경우)
  OkPacket {
    fieldCount: 0,
    affectedRows: 1,
    insertId: 0,
    serverStatus: 2,
    warningCount: 0,
    message: '(Rows matched: 1  Changed: 1  Warnings: 0',
    protocol41: true,
    changedRows: 1
  }
  
  업데이트한 경우 (1개 컬럼 업데이트, 데이터 변화 없을 경우)
  OkPacket {
    fieldCount: 0,
    affectedRows: 1,
    insertId: 0,
    serverStatus: 2,
    warningCount: 0,
    message: '(Rows matched: 1  Changed: 0  Warnings: 0',
    protocol41: true,
    changedRows: 0
  }
  
  인서트한 경우 (1개 행 인서트)
  OkPacket {
    fieldCount: 0,
    affectedRows: 1,
    insertId: 11,
    serverStatus: 2,
    warningCount: 0,
    message: '',
    protocol41: true,
    changedRows: 0
  }
  */
  
  
  //-------------------------------------------------------------------------
  // 2. 업서트 하기. 
  //-------------------------------------------------------------------------
  /*const strUserUid = event.userUid; // 1
  const strFcmToken = event.fcmToken; // 2
  const str = event.nickName; // 3  
  event.ageRange; // 4
  event.gender; // 5
  const str = event.region; // 6
  const str = event.userLanguage; // 7
  event.acceptJorugi; // 8
  event.acceptRandom; // 9
  event.isBlockedUser; // 10
  event.funUserScore; // 11
  event.goldHandScore; // 12
  event.userLevel; // 13
  const str = event.originSNS; // 14
  event.reporting; // 15
  event.reported; // 16
  event.agreeTerms; // 17
  event.useSound; // 18
  event.userLevelScore; // 19
  */
  
  //-------------------------------------------------------------------------
  // 업서트 성공했으면, 다시 그 계정 정보 읽어서, GetUserInfo 처럼 돌려주기.
  //-------------------------------------------------------------------------
  
  
  
  /* 
  어떤 파람이 넘어올지 모를때
  
  //-------------------------------------------------------------------------
  // 1. 자, 이제 리퀘스트 받은 이벤트 정보중에 뭐가 몇개나 있는지 보자. 
  //    그러면서 최종 쿼리문에 사용할 스트링도 만들어가고. 
  //-------------------------------------------------------------------------
  let numOfParams = 0;
  
  // 쿼리 파라메터 스트링을 구성해갈건데,
  // 넘어온 파라메터의 개수에 따라서, 업데이트용으로 사용할건지, 인서트용으로 사용할건지 결정됨)
  
  //-------------------------------------------------
  // 두 스트링을 동시에 만들어가다가, 넘어온 파라메터 개수에 따라 인서트 인지 업데이트 인지를 결정함. 
  let insertQueryStr = 'VALUES ('; 
  let updateQueryArray = new Array();
  
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #1. 유저유아이디
  const strUserUid = event.userUid;
  numOfParams++;
  insertQueryStr += '\'' + strUserUid + '\'';
  // 업데이트용 은 넣을것 없고. 왜? 유저유아이디가 PK이므로. 
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #2. 오리진에센에스
  const strOriginSNS = event.originSNS;
  numOfParams++;
  insertQueryStr += ', \'' + strOriginSNS + '\'';
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // 여기서부터는 업데이트할 수 있는 대상들. 
  // #3. 에프씨엠 토큰
  if(event.fcmToken != null)
  {
    numOfParams++;
    insertQueryStr += ', \'' + event.fcmToken + '\'';
    updateQueryArray.push('fcmToken=\'' + event.fcmToken + '\'');
  }
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #4. nickName : str
  if(event.nickName != null)
  {
    numOfParams++;
    insertQueryStr += ', \'' + event.nickName + '\'';
    updateQueryArray.push('nickName=\'' + event.nickName + '\'');
  }
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #5. ageRange : int
  if(event.ageRange != null)
  {
    numOfParams++;
    insertQueryStr += ', event.ageRange';
    updateQueryArray.push('ageRange=event.ageRange');
  }
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #6. gender : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #7. region : str
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #8. userLanguage : str
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #9. acceptJorugi : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #10. acceptRandom : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #11. isBlockedUser : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #12. funUserScore : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #13. goldHandScore : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #14. userLevel : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #15. reporting : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #16. reported : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #17. agreeTerms : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #18. useSound : int
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // #19. userLevelScore : int
  
  
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
  // 쿼리문 내용 일단 완료. 
  insertQueryStr += ') ';// 마무리 괄호
  
  // 업데이트 스트링 쉼표 넣기. 
  const dataSize = updateQueryArray.length;
  if( dataSize > 1 )
  {
    for(var idx=0; idx<idxMax; idx++)
    {
  
    }
  }else // 업데이트할 데이터가 1개만 넘어온 경우. 
  {
  
  }
  
  console.log(numOfParams);
  console.log(insertQueryStr);
  console.log(updateQueryArray[0]);
  */
  
    // Use this code if you don't use the http event with the LAMBDA-PROXY integration
    // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
  };
  
