//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 상위 랭킹인 베스트 게임(레이팅이 높은)들의 리스트를 리스폰스 하는 람다. 
//
// 
// 2021.12.02. sjjo. Initial. 
//                   리스폰스 타입은, GetMyGameList 와 동일하다. (X 본인이 레이팅했는지 여부는 안줌)
//
// 2021.12.17. sjjo. 이제, 셋레이팅 api도 했으니, 제대로 상위 순위를 가져오기. 
// 2021.12.21. sjjo. 도우심을 구하며, 겨우겨우, 랭킹+이미지 주소까지 가져왔다. 첫 디플로이.
// 
//-------------------------------------------------------------------------------------
// References.
// 
// * GROUP BY, HAVING : 어디쓸진 모르겠지만. 
//   : https://dlwjdcks5343.tistory.com/57?category=764569 
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

// 좀 어거지 이지만, 바로 보이지 않고, 들어가야 보이면 좀 호기심 더 있지 않을까?
// 일단 최종인지, 첫 그림인지 뭔가 프로그래스 데이블에서 이미지 주소 가져오기 쿼리가 좀 부담스럽네. 2021.12.17.
const bestgamecover_image = "https://sjtest0204-upload.s3.ap-northeast-2.amazonaws.com/sb_endgame_img.png";


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
          const errMsg = "[GetBestGameListV2] [ERROR]: db-error:" + err;
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

module.exports.GetBestGameListV2 = async (event) => {

//-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------

  // 유져 인덱스가 왜 필요함? 자기가 베스트 픽에 표시 했는지 안했는지 알아야 해서. 
  // 2021.12.21. 
  // 이건 게임 자체에 들어가면 그 때 보여주는 걸로 하자. 
  // 왜? 이게 제일 자주불리는 람다중에하나인데, 이거 확인하려면 2번 쿼리해야 해서. 
  /*
  if( (event.userIdx==null) )
  {
    const err_msg = "[GetBestGameListV2] [Serious Error!!] Invalid Request Data! userIdx is NULL! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }*/


  /*
# 재미있어요 우선, 금손우선, 그 다음 최신순 정렬 쿼리문.
SELECT S.gameIdx, S.funScore, S.goldHandScore, G.status FROM ScoreCountTable AS S
						 INNER JOIN GameTable AS G 
                           ON G.gameIdx=S.gameIdx 
                           ORDER BY S.funScore DESC, S.goldHandScore DESC, S.gameIdx DESC
						   LIMIT 5;  
  */
/*
SELECT * FROM GameHistoryTable 
			WHERE progressIdx=(SELECT MAX(progressIdx) FROM GameHistoryTable WHERE gameIdx=244);
*/

  const strSortPriority = event.sortPriority;
  let queryResult = null;
  let queryStrBestGameList = null;
  //--------------------------------------------
  // 0. 넘어온 파라메터가 없다면, 
  // 재미 레이팅 우선, event.sortPriority : [fun, goldhand]
  // 리스트 개수는 5개. event.reqNumOfGames : [#]
  //--------------------------------------------


  //--------------------------------------------
  // 1. 가져올 개수 설정. 
  //--------------------------------------------
  let intNumOfGames = event.reqNumOfGames;

  if( intNumOfGames == null ) intNumOfGames = 5; // It's default num of game which is requested.
  else;

  //--------------------------------------------
  // 2. 재미 레이팅 우선인지, 잘그림 레이팅 우선인지 결정.
  //--------------------------------------------
  /*
    # 프로그래스 테이블과 스코어 카운트 테이블의 조인. 맨 마지막 이미지 보여주기.
    SELECT * FROM (SELECT  * FROM ScoreCountTable AS S ORDER BY S.funScore DESC, S.goldHandScore DESC, S.gameIdx DESC LIMIT 3) AS A 
        INNER JOIN GameProgressTable AS P ON P.gameIdx=A.gameIdx
          WHERE P.turnNumber=P.maxTurn;

    # 프로그래스 테이블과 스코어 카운트 테이블의 조인. 첫번째 이미지 보여주기.
    SELECT * FROM (SELECT * FROM ScoreCountTable AS S ORDER BY S.funScore DESC, S.goldHandScore DESC, S.gameIdx DESC LIMIT 3) AS A 
        INNER JOIN GameProgressTable AS P ON P.gameIdx=A.gameIdx
          WHERE P.turnNumber=1; 

    # 주님, 감사합니다. 분별 잘하게 하여 주십시요. 
    SELECT A.gameIdx, G.createdTime, G.endTime, G.turnCount, 
        L.lang, L.localizedKeyword,
        A.funScore, A.goldHandScore, P.imageUrl FROM (SELECT * FROM ScoreCountTable AS S ORDER BY S.funScore DESC, S.goldHandScore DESC, S.gameIdx DESC LIMIT 3) AS A 
        INNER JOIN GameProgressTable AS P ON P.gameIdx=A.gameIdx
            INNER JOIN GameTable AS G ON G.gameIdx=A.gameIdx 
            INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx 
          WHERE P.turnNumber=1 
            AND G.keywordLanguage=L.lang;          
      */
  if( strSortPriority == "goldhand" )
  {
    queryStrBestGameList = 'SELECT A.gameIdx, G.createdTime, G.endTime, G.turnCount,'
                          + ' ' + 'L.lang, L.localizedKeyword,'
                          + ' ' + 'A.funScore, A.goldHandScore, P.imageUrl'
                              + ' ' + 'FROM ('
                                            + 'SELECT * FROM ScoreCountTable AS S ORDER BY S.goldHandScore DESC, S.funScore DESC, S.gameIdx ASC'
                                            + ' ' + 'LIMIT ' + intNumOfGames + ') AS A'  /*  서브 쿼리로 먼저 추리고 */
                              + ' ' + 'INNER JOIN GameProgressTable AS P ON P.gameIdx=A.gameIdx'
                              + ' ' + 'INNER JOIN GameTable AS G ON G.gameIdx=A.gameIdx'
                              + ' ' + 'INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx'

                                  + ' ' + 'WHERE P.turnNumber=1' /* 그림은 첫 그림으로. */
                                  + ' ' + 'AND G.keywordLanguage=L.lang' + ';';

  }else // 널인경우 포함해서, 다, 재미있음 위주로 소팅. 일단. 2021.12.17. 본인이 한 레이팅 여부 정보 빼고, 함. 
  {
    queryStrBestGameList = 'SELECT A.gameIdx, G.createdTime, G.endTime, G.turnCount,'
                          + ' ' + 'L.lang, L.localizedKeyword,'
                          + ' ' + 'A.funScore, A.goldHandScore, P.imageUrl'
                              + ' ' + 'FROM ('
                                            + 'SELECT * FROM ScoreCountTable AS S ORDER BY S.funScore DESC, S.goldHandScore DESC, S.gameIdx ASC'
                                            + ' ' + 'LIMIT ' + intNumOfGames + ') AS A'  /*  서브 쿼리로 먼저 추리고 */
                              + ' ' + 'INNER JOIN GameProgressTable AS P ON P.gameIdx=A.gameIdx'
                              + ' ' + 'INNER JOIN GameTable AS G ON G.gameIdx=A.gameIdx'
                              + ' ' + 'INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx'

                                  + ' ' + 'WHERE P.turnNumber=1' /* 그림은 첫 그림으로. */
                                  + ' ' + 'AND G.keywordLanguage=L.lang' + ';';

  }

  //--------------------------------------------
  // 3. DB 접근 하기.
  //--------------------------------------------
  try{

    queryResult = await queryThisFromTheTable(queryStrBestGameList);

    //console.logDebug("------");
    //console.logDebug(queryResult);


    const intResultNum = queryResult.length;

    const return_body = {
      numOfGames: intResultNum,
      bestGames: queryResult
    };

    // 그냥 리스폰스 일원화.                         
    return sendRes(200, return_body);



  }catch(error)
  {

    const err_msg ="[GetBestGameListV2] [Error] SELECT FAIL. DB Access or etc.: " 
            + "event: " + JSON.stringify(event)
            + " > " + error;
    console.log( err_msg );                    
    return sendRes(400, err_msg);    

  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
