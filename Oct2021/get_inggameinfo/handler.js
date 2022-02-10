//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 리퀘스트 받은 사용자가 해야할 차례인 게임과 
//                       참여했는데 진행중인 게임의 JSON 정보를 
//          요청한 개수 만큼 구성해서 리스폰스하는 람다
//
// 
// 2021.10.20. sjjo. Initial. 
// 
//
//-------------------------------------------------------------------------------------

'use strict';
const mysql = require('mysql');

const game_current_table = 'GameCurrentTable';
const game_history_table = 'GameHistoryTable';



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

    mysql_connection.query(query_string, function(err, result, field) {
        if(result)
          resolve(result);
        
        if(err)
          console.log("[GetMyturnGame] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}

const isLocal = 1; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
// feat. JY.
// var os = require('os'); console.log( os.hostname() );
// 근데 이거 계속 부를 때마다 실행하는게 맞나? 실행시간.. 
// 일단 실행시간 써도될 꼭 필요한 경우만 쓰자. 
//---------------------------------
// 표준 response 를 보내기 위해. 
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


module.exports.GetIngGameInfo = async (event) => {

  // 리퀘스트 온 정보들을 저장하고, (가독성과 사용의 편리를 위해)
  const intUserIdx = event.userIdx;
  const dateReqTimestamp = event.reqTimestamp;

  // 이건 null 일수도 있으므로.   
  let intNumOfGames = null;
  if( event.numOfGames == null ) intNumOfGames = 5; 
  else intNumOfGames = event.numOfGames; 

  let queryResult = null; 

  // Array <int> arrInt_gameIndices; // 내가할 차례인 (당연히 진행중) 그리고 내가 했는데 아직 진행중인 게임인덱스 전체를 저장하기 위한 어레이. 

  let arrInt_gameIndices = new Array();
  //###################################
  //
  // 단계별로 해보자. 
  // 1. 내가할 차례, 내가 참여했는데 안끝난 것들의 gameIdx 를 구해서 확인. 
  // 2. 이걸 시간순으로, 구할수 있나 검토. 
  // 3. 시간순으로 구해진걸 5개씩 자를 수 있나 검토. 
  // 4. 그게 다 되었다면, 구해진 gameIdx로 json 구하는 루틴 돌려서 json 구성해서 리스폰스하기. 
  //
  //###################################

  // console.log("TEST: " + intNumOfGames);

  
  //-----------------------------------------------------------------------------------
  // STEP 1. 이 사람이 해야할 차례인 게임의 인덱스를 구하기. 
  //-----------------------------------------------------------------------------------
  try{

    const query_gameInfo = 'SELECT gameIdx FROM ' + game_current_table + ' WHERE nextUserIdx=' + intUserIdx + ';';
    
    const queryResult = await queryThisFromTheTable(query_gameInfo);

    const intResultNum = queryResult.length;

    const return_body = {
                          numOfGames: intResultNum
                        };


    return sendRes(200, queryResult);                        

    if( intResultNum > 0 )
    {
      //return sendRes(200, return_body);


    }else
    {
      // 해당 사용자가 해야할 게임이 없음. 
      // (즉, 해당 사용자가 GameCurrentTable에 없음. 왜? GameCurrentTable은, 다음턴이 누구인지만 기록하는 테이블이므로.)
      // return sendRes(202, return_body);

    }



  }catch(error)
  {
    console.log("[GetMyturnGame] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }



  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
