//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 리퀘스트 받은 사용자가 해야할 차례인 게임의 정보중, 리스트 자체의 표시를 위한 값을 리스폰스 하는 람다. 
//
// 
// 2021.11.17. sjjo. Initial.
// 2021.11.18. sjjo. The first deploy.
//
//-------------------------------------------------------------------------------------

'use strict';
const mysql = require('mysql');



//---------------------------------------------------------------------
// SB MySql DB 쿼리 함수.
//---------------------------------------------------------------------
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
          console.log("[GetMyturnGameList] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}

//---------------------------------------------------------------------
// 표준 response 를 보내기 위해. + 에러 리스폰스 처리를 합침.
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



module.exports.GetMyturnGameList = async (event) => {


  //-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------
  if( (event.userIdx==null) || (event.timeStamp==null) || (event.reqNumOfGames==null) )
  {
    const err_msg = "[GetMyturnGameList] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  // 리퀘스트온 사용자의 idx를 저장하고, (가독성과 사용의 편리를 위해)
  const intUserIdx = event.userIdx;
  const intReqNumOfGames = event.reqNumOfGames;
  const reqTimeStamp = event.timeStamp; // "2021-11-15 08:25:23"
  let queryResult = null; 
  

  /*
# 2021.11.17. 내가할 차례인 게임의 기본정보 쿼리.
SELECT C.gameIdx, G.createdTime, P.tossedTime, C.turnNumber, C.maxTurn
   FROM GameCurrentTable AS C 
		INNER JOIN GameTable AS G ON C.gameIdx = G.gameIdx 
        INNER JOIN GameProgressTable AS P ON C.progressIdx = P.progressIdx
          WHERE C.nextUserIdx=3;  
  */
  //-------------------------------------------------------------------------
  // 1.A 시간 고려 안한 쿼리문 테스트. 
  // 
  //-------------------------------------------------------------------------
  /*
  const query_MyturnGameList = 'SELECT C.gameIdx, G.createdTime, P.tossedTime, P.turnNumber, C.maxTurn'
                                + ' ' + 'FROM GameCurrentTable AS C'
                                + ' ' + 'INNER JOIN GameTable AS G ON C.gameIdx = G.gameIdx'
                                + ' ' + 'INNER JOIN GameProgressTable AS P ON C.progressIdx = P.progressIdx'
                                      + ' ' + 'WHERE C.nextUserIdx=' + intUserIdx
                                + ';';
  */
  //-------------------------------------------------------------------------
  // 1.B 자, 이제 시간 고려 '한' 쿼리문 테스트. 
  //     만든시간 기준으로? 토스 한 시간 기준으로?
  // Ref. https://sql-factory.tistory.com/1101 
  //-------------------------------------------------------------------------                                
  const query_MyturnGameList = 'SELECT C.gameIdx, G.createdTime, P.tossedTime, P.turnNumber, C.maxTurn, P.imageUrl'
                                + ' ' + 'FROM GameCurrentTable AS C'
                                + ' ' + 'INNER JOIN GameTable AS G ON C.gameIdx = G.gameIdx'
                                + ' ' + 'INNER JOIN GameProgressTable AS P ON C.progressIdx = P.progressIdx'
                                      + ' ' + 'WHERE C.nextUserIdx=' + intUserIdx
                                            + ' ' + 'AND P.tossedTime<' + '\'' + reqTimeStamp + '\''
                                            + ' ' + 'ORDER BY P.tossedTime DESC'
                                            + ' ' + 'LIMIT ' + intReqNumOfGames
                                + ';';


  //console.log(query_MyturnGameList);
  
  //-------------------------------------------------------------------------
  // 2. DB 접근.
  // 
  //-------------------------------------------------------------------------
  try{

    queryResult = await queryThisFromTheTable(query_MyturnGameList);

    //console.log("------");
    //console.log(queryResult);


    const intResultNum = queryResult.length;

    const return_body = {
                          userIdx: intUserIdx, 
                          numOfGames: intResultNum,
                          myturnGames: queryResult
                        };

    // 그냥 리스폰스 일원화.                         
    return sendRes(200, return_body);
    /* 2021.11.16                         
    if( intResultNum > 0 )
    {
      return sendRes(200, return_body);
    }else
    {
      // 해당 사용자가 해야할 게임이 없음. 
      // (즉, 해당 사용자가 GameCurrentTable에 없음. 왜? GameCurrentTable은, 다음턴이 누구인지만 기록하는 테이블이므로.)
      return sendRes(202, return_body);
    }
    */



  }catch(error)
  {

    const err_msg ="[GetMyturnGameList] [Error] SELECT FAIL. DB Access or etc.: " 
            + "event: " + JSON.stringify(event)
            + " > " + error;
    console.log( err_msg );                    
    return sendRes(400, err_msg);

  }

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
