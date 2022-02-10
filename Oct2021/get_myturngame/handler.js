//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 리퀘스트 받은 사용자가 해야할 차례인 게임의 개수를 리스폰스하는 람다
//
// 
// 2021.10.14. sjjo. Initial.
// 2021.10.19. sjjo. 해야할 게임의 개수만 돌려주는 걸로 변경. 
//
//-------------------------------------------------------------------------------------

'use strict';
const mysql = require('mysql');

const game_current_table = 'GameCurrentTable';


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

const isLocal = 0; // 아직 로컬 실행인지 확인하는 방법 모르겠다. 
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


module.exports.GetMyturnGame = async (event) => {

  // 리퀘스트온 사용자의 idx를 저장하고, (가독성과 사용의 편리를 위해)
  const intUserIdx = event.userIdx;
  let queryResult = null; 
  

  try{

    const query_gameInfo = 'SELECT gameIdx FROM ' + game_current_table + ' WHERE nextUserIdx=' + intUserIdx + ';';
    
    const queryResult = await queryThisFromTheTable(query_gameInfo);

    const intResultNum = queryResult.length;

    const return_body = {
                          numOfGames: intResultNum
                        };

    if( intResultNum > 0 )
    {
      return sendRes(200, return_body);
    }else
    {
      // 해당 사용자가 해야할 게임이 없음. 
      // (즉, 해당 사용자가 GameCurrentTable에 없음. 왜? GameCurrentTable은, 다음턴이 누구인지만 기록하는 테이블이므로.)
      return sendRes(202, return_body);
    }



  }catch(error)
  {
    console.log("[GetMyturnGame] [Error] SELECT FAIL. DB Access or etc.:  " + " > " + error);
    return sendRes(400, error);
  }

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
