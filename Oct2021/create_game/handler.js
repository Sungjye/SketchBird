//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 처음 게임을 만들때 호출되는 람다
//
// 
// 2021.08.26. sjjo. OLJPHM
// 2021.09.08. sjjo. 1차 완료.
// 2021.09.14. sjjo. gameInfo 에 "keywordLanguage": "ko", 필드 추가. 
//                   finishedUsers 에 "userLanguage": "ko", 필드 추가.
//                   nextUser 에 "userLanguage": "ko", 필드 추가.
//                   JS와 협의 완료. 
// 2021.10.21. sjjo. http response code 를 제대로 보내기 위한 리스폰스 코드 추가 및 변경.
//
//
//-------------------------------------------------------------------------------------


'use strict';

const mysql = require('mysql');

//--------------------------------------------------------------------------------------
// 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? 
// assign 되는 숫자 바꿀려면, CreateGame, TossGame, GetGameInfo 3군데 코드 다 바꿔야 함!
const CONST_GAME_STATUS__START = 0;
//const CONST_GAME_STATUS__ING = 1;
//const CONST_GAME_STATUS__END = 2;
//const CONST_GAME_STATUS__DROP = 3;
//const CONST_GAME_STATUS__ERR = 4;


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
          console.log("[CreateGame] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}

const isLocal = 0; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
// feat. JY.
// var os = require('os'); console.log( os.hostname() );
// 근데 이거 계속 부를 때마다 실행하는게 맞나? 실행시간.. 
// 일단 실행시간 써도될 꼭 필요한 경우만 쓰자. 
//---------------------------------
// 표준 response 를 보내기 위해. 
const sendRes = (status, rcv_body) => {
  let response = null;

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
      return response;
  }else
  {
      // 이거!! CLI sls local 인 경우, 이거 해줘야 에러 안나고 실행된다. 
      // rcv_body는 사실상 JSON 인데. 
      // 뭔가 잘 이해는 안되지만, 실험적으로, 이렇게 해서 동작하게. 2021.08.17
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
    return response;
  }  
};

// https://dikshit18.medium.com/mapping-api-gateway-with-lambda-output-e8ea9e435bbf
// feat. JY.
const sendErr = (status, rcv_body) => {
  let response=null;



  // 헤더도..잘 모르겠지만, 구색상 추가.. 
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

  //console.log("THROW ERR in func");

  throw new Error(JSON.stringify(response));


}


module.exports.CreateGame = async (event) => {


/*
    callback(null, 
            {
              gameInfo: {    
                id: chainUid, 
                createdUserId: event.userid, 
                jsonBucket: usingBucketForJson,
                createdTime: timeUid,
                currentTurn: 0,
                maximumTurn: +event.maxturn,
                gameType: event.gametype,
                category: tentativeCategory, 
                keyword: event.keyword,
                repUrl: "http://www.handover.com/234kl239@#$d99lkkadkf9912"
              }, 
              "finishedUsers": [
                  {
                  }
                ],
                "nextUser": {
                    
                },
                "sys": {
                    "createdTimestamp": curr_time,
                    "endTimestamp": ""
                },
                "timezone": -25200
            }    
            );
*/
// https://usefulangle.com/post/305/nodejs-get-date-time-for-timezone
// https://stackoverflow.com/questions/221294/how-do-you-get-a-timestamp-in-javascript 

//let nz_date_string = new Date().toLocaleString("en-US", { timeZone: "Pacific/Chatham" });
//console.log(nz_date_string);
//let universal_date_string = new Date().toLocaleString("en-US", { timeZone: "Universal" });
//console.log(universal_date_string);


  //-------------------------------------------------------------------------
  //++ STEP 1. 받은 이벤트에서 db에 쓰거나, 리턴할 데이터를 구성하고, 
  //-------------------------------------------------------------------------
  let TABLE_NAME; 
  let queryResult = null; 
 
  //+ DB 에서 온 결과의 이름을 따로 바꾸지 않고 그대로 쓰기 위해서
  //+ DB column 이름을 그대로 따름. 대소문자 등.
  
  const nCreatorIdx = event.createdUserIdx;
  const sCreatedUserId = event.createdUserUid;
  const nKeywordIdx = event.keywordIdx;
  const sSelectedLangKeyword = event.selectedLangKeyword; // 리턴 제이슨에 써주기 위해서. 앱단에서는 키워드 얻어올 때 알고 있다. 

  //--------------------------------------------------
  // 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 
  //                            3==드롭, 4==뭔가 문제?
  const nStatus = CONST_GAME_STATUS__START; 

  const nTurnCount = event.maxTurn; // 말이 좀 헛갈리지만, GameTable 에서 JY가 이렇게 정의했네.
  const nTurnNumber = 1; // 게임을 최초로 만든 사람에게 할당되는 자기 차례의 턴수. 정하기 나름인데, 만든 자신이 처음이므로 1로.
    
  const dEndTime = null;
  //---------------------------------------------------------
  // 숫자로. 0 friend 아는 사람끼리, 1 everyone 모르는 (모든) 사람끼리
  // 게임 타입은, 기존 json 에 텍스트 였지만, 2021.09.02 JS와의 협의후, int 로 사용.
  const nGameType = event.gameType; 
  
  const strKeywordLanguage = event.keywordLanguage; // 2021.09.14.


  //-------------------------------------------------------------------------
  //++ STEP 2. 게임의 정적인 정보를 기록: GameTable : 게임 시작과 종료시.
  //            db 에 쓸것은 없나? 없지. 일단 toss 첫번쨰로 해야 시작되니까.  
  //            가 아니고, 다음 항목들을 GameTable 에 써줘야 한다. 
  //            제일 중요한건, GameIdx 를 받아와야 하니까. 
  //            
  //-------------------------------------------------------------------------
  //let universal_date_string = new Date().toLocaleString("en-US", { timeZone: "Universal" });
  // DB 함수 사용? 이것 사용?
  try{

    // test
    //throw "test error";

    //+ 만든 시간은, 람다에서 구해도 되지만, db 쓰기에 시간이 걸릴수도 있기 떄문에 
    //+ DB의 함수를 이용하는 것이 맞다?
    //+ 쿼리 비용을 줄일려면, 여기서 호출하는 것이 맞고. 
    TABLE_NAME = 'GameTable';
    const queryStartGame = 'INSERT INTO ' + TABLE_NAME + ' '
                          + '('
                          + 'status'
                          + ', creatorIdx'
                          + ', createdTime'
                          + ', keywordLanguage' /* 2021.09.14 */
                          + ', keywordIdx'
                          + ', turnCount'
                          + ', endTime'
                          + ', gameType'
                          + ') ' 
                          
                          + 'VALUES ('
                          +  nStatus
                          + ', ' + nCreatorIdx
                          + ', Now()'
                          + ', ' + '\'' + strKeywordLanguage + '\'' /* 2021.09.14 */
                          + ', ' + nKeywordIdx
                          + ', ' + nTurnCount
                          + ', ' + dEndTime
                          + ', ' + nGameType
                          +');';

    queryResult = await queryThisFromTheTable(queryStartGame);
    
    /* 지우지 말것
    OkPacket {
      fieldCount: 0,
      affectedRows: 1,
      insertId: 8,
      serverStatus: 2,
      warningCount: 0,
      message: '',
      protocol41: true,
      changedRows: 0
    }
    */
    //console.log(mysqlResult.insertId);
    
    // 인서트한 GameIdx 는 이것. 
    const nINSERTed_GameIdx = queryResult.insertId;
    const strINSERTed_GameIdx = nINSERTed_GameIdx.toString();// 2021.09.02 협의
    //console.log(nINSERTed_GameIdx);

    //-------------------------------------------------------------------------
    //++ STEP 2-1. 어쩔수 없이 시간 받아와야 하는구나. 
    try{
      // 위에서 정의한 테이블과 동일. TABLE_NAME = 'GameTable';
      //const queryTimestampData = 'SELECT createdTime FROM ' + TABLE_NAME + ';';
      //왜 됐지? const queryTimestampData = 'SELECT createdTime FROM ' + TABLE_NAME + ' ' + 'WHERE gameIdx=' + strINSERTed_GameIdx +';';
      const queryTimestampData = 'SELECT createdTime FROM ' + TABLE_NAME + ' ' + 'WHERE gameIdx=' + nINSERTed_GameIdx +';';

      //console.log(queryTimestampData);

      queryResult = await queryThisFromTheTable(queryTimestampData);


    }catch(error)
    {
    //-------------------------------------------------------------------------
    //++ STEP 2-2. db 쓰기에 실패했으면 실패 리스폰스 하자. 
    //-------------------------------------------------------------------------
      /*
      console.log("[CreateGame] [Error] 'createdTime' SELECT FAIL. DB Access or etc.:  " + " > " + error);
      return sendRes(400, error);        
      */
      const strErrMsg = "[CreateGame] [Error] 'createdTime' SELECT FAIL. DB Access or etc.:  " + " > " + error;        
      console.log(strErrMsg);
      return sendErr(400, strErrMsg);     
    }

    //const dateCreatedTime = queryResult.createdTime; // 배열인덱싱 해줘야 하네.
    const dateCreatedTime = queryResult[0].createdTime;
    //console.log(queryResult);
    //console.log(dateCreatedTime); //2021.09.02 리스폰스 제이슨 다 되었는데, 시간 쿼리해와서 써줘야 할것 같아서. 
    
    //-------------------------------------------------------------------------
    //++ STEP 3-1. db에 잘 써졌으면 리스폰스 하자. 
    // 
    //-------------------------------------------------------------------------
    
    //-------------------------------------------------------
    // 기존 ddb 연동 json 과 호환성을 위해서, response 는 ~~progress 를 string으로 하고~~ progress 도 int로. 
    // 기존 앱 규칙대로 유지해 주자. 
    //--------------------------------------------------
    // nStatus. 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 
    //                            3==드롭, 4==뭔가 문제?
    // 2021.09.02 gameInfo.currentTurn 이 2 이면, 첫 토스 이후에 
    /*
    let sGameStatus;
    switch( nStatus ){ // 처음 게임 만드는 거니 in progress 일수 밖에 없지만, 다른 곳에서도 코드 가독성을 위해, 람다시간 몇ms 희생..?!
      case 0: 
        sGameStatus = "in progress";
        break;
      case 1:
        sGameStatus = "in progress";
        break;
      case 2: 
        sGameStatus = "finished";
        break;
      case 3:
        sGameStatus = "drop";
        break;        
      default:
        sGameStatus = "someting wrong";
        break;
    }
    */

    const return_body = {
      gameInfo: {
        /* dynamo db 버전연동의 json 과 호환을 유지하기 위해 이름을 id로. 자동증가 되는 game의 uid index. unsigned int. */
        id: strINSERTed_GameIdx, 
        createdUserId: sCreatedUserId,
        creatorIdx: nCreatorIdx,        
        currentTurn: nTurnNumber, /* 만든사람의 회차. 정하기 나름. */
        maximumTurn: nTurnCount,
        gameType: nGameType, /* 숫자로. 0 friend 아는 사람끼리, 1 everyone 모르는 (모든) 사람끼리 */
        keywordLanguage: strKeywordLanguage, /* 2021.09.14 */
        keyword: sSelectedLangKeyword, /* 일단 앱에서 넘어온 언어의 키워드 그대로. 2021.09.02 */
        keywordIdx: nKeywordIdx,
        category: null, /* 아직은 사용하지 않으므로 2021.09.02 */
        progress: nStatus,
        createdTime: dateCreatedTime /* 얻어와서 쓰자. 시간. 2021.09.08 */ /* 첫 토스가 이루어지는 시점에서, 데이터 제대로 구성. 비용도 쓰고. DB에서 비용들여서 가져와? 아님 첫 toss 하면 어차피 붙으니, 첫 toss 하기 전까지 필요없으면 가져오지 말자. */
        },
      finishedUsers: [
        {}
        ],
      nextUser: {},
      sys: {
        createdTimestamp: dateCreatedTime, /* 얻어와서 쓰자. 시간. 2021.09.08 */ /* DB에서 비용들여서 가져와? 아님 첫 toss 하면 어차피 붙으니, 첫 toss 하기 전까지 필요없으면 가져오지 말자. */
        endTimestamp: null
        },
      timezone: -25200 // TBD.
        }  

    //let nz_date_string = new Date().toLocaleString("en-US", { timeZone: "Pacific/Chatham" });
    //console.log(nz_date_string);
    //let universal_date_string = new Date().toLocaleString("en-US", { timeZone: "Universal" });
    //console.log(universal_date_string);

    return sendRes(200, return_body);
       

  }catch(error)
  {
    //-------------------------------------------------------------------------
    //++ STEP 3-2. db 쓰기에 실패했으면 실패 리스폰스 하자. 
    //-------------------------------------------------------------------------
    /*
    console.log("[CreateGame] [Error] INSERT FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
    */
    
    const strErrMsg = "[CreateGame] [Error] INSERT FAIL. DB Access or etc.:  " + " > " + error;        
    console.log(strErrMsg);
    return sendErr(400, strErrMsg);  

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
