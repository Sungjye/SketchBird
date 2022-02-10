//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 상위 랭킹인 베스트 픽쳐 겜들의 리스트를 리스폰스 하는 람다. 
//
// 
// 2021.12.02. sjjo. Initial. 
//                   리스폰스 타입은, GetBestPicList 와 동일하다. 
//
//-------------------------------------------------------------------------------------
// References.
// 
//-------------------------------------------------------------------------------------

'use strict';

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
          const errMsg = "[GetBestPicList] [ERROR]: db-error:" + err;
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


module.exports.GetBestPicList = async (event) => {

  // 2021.12.02. 일단은 내 게임 리스트를 그대로 갖다 쓴다. 
  // 다음 파라메터만 넣어서.


  //-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------
  /*
  if( (event.userIdx==null) || (event.gameStatus==null) || (event.timeStamp==null) || (event.reqNumOfGames==null) )
  {
    const err_msg = "[GetBestPicList] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }

  // 리퀘스트온 사용자의 idx를 저장하고, (가독성과 사용의 편리를 위해)
  const intUserIdx = event.userIdx;
  const intStatus = event.gameStatus;
  const intReqNumOfGames = event.reqNumOfGames;
  const reqTimeStamp = event.timeStamp; // "2021-11-15 08:25:23"
  */
  // 임시!!!
  const intUserIdx = 15; //event.userIdx;
  const intStatus = 2; //event.gameStatus;
  const intReqNumOfGames = 5; //event.reqNumOfGames;
  const reqTimeStamp = "2021-11-30 23:51:59"; //event.timeStamp; // "2021-11-15 08:25:23"

  let queryResult = null; 
  

  // 쿼리해야 하는 정보는?
  // 내가 했는데, 진행중인 경우와, 
  // 내가 했는데, 완료된 경우가 있으니까
  // 생각 잘해야 한다. 
  /*
  
  [진행중인 경우]
    userIdx (리퀘스트)
    gameStatus (리퀘스트)
    numOfGames (쿼리결과종합)
    myGames 
      gameIdx (GameCurrent T.)
      createdTime (Game T.)
      tossedTime (GameProgress T.)
      turnNumber ()
      maxTurn ()
      userIdx
      nextUserIdx

  [완료된 경우]

  */

  let query_MyGameList = null;

  if( intStatus == 1 )
  {
  //-------------------------------------------------------------------------
  // 1.A [진행중인 경우] 
  //   : 리퀘스트 파람으로 온 사용자는 했는데, "아직 진행중인" 게임의 경우 쿼리문. 
  //   : 어차피 직전 사용자, 이제할 사용자 정보 가져오려면 프로그래스 테이블 쿼리 해야 하네. 
  //
  //-------------------------------------------------------------------------
  // 그런데, 문제는, 내가 참여했고 내 다음턴도 넘어간 경우, 그것의 현재 상태는 누가하고 있나(프로그래스인덱스는..)...
  // 게임커런트 테이블에 있네. 진행중인 게임이면, 무조건 커런트테이블에 남아 있으니. 
  // 그래서 4중 조인 할수 밖에 없다...
  /*
  SELECT H.gameIdx, G.createdTime, P.tossedTime, P.turnNumber, P.maxTurn, P.userIdx, P.nextUserIdx 
	FROM GameHistoryTable AS H 
    INNER JOIN GameTable AS G 
    ON H.gameIdx = G.gameIdx 
    INNER JOIN GameCurrentTable AS C 
    ON G.gameIdx = C.gameIdx 
    INNER JOIN GameProgressTable AS P 
    ON C.progressIdx = P.progressIdx 
		WHERE H.userIdx=15 
			AND G.status=1
            AND P.nextUserIdx!=15
            AND G.createdTime<'2021-11-05 23:33:59' ORDER BY G.createdTime DESC LIMIT 4;
            # 두사람이 반복해서 주고 받는 경우, 내가 할 차례인데, 이 쿼리에서 나오는 경우 있어서. not equal 조건 추가함.                
  */
 /*
  query_MyGameList = 'SELECT H.gameIdx, G.createdTime, P.tossedTime, P.turnNumber, P.maxTurn, P.userIdx, P.nextUserIdx'
                      + ' ' + 'FROM GameHistoryTable AS H'
                            + ' ' + 'INNER JOIN GameTable AS G ON H.gameIdx = G.gameIdx'
                            + ' ' + 'INNER JOIN GameCurrentTable AS C ON G.gameIdx = C.gameIdx'
                            + ' ' + 'INNER JOIN GameProgressTable AS P ON C.progressIdx = P.progressIdx'
                                  + ' ' + 'WHERE H.userIdx=15'
                                        + ' ' + 'AND G.status=1'
                                        + ' ' + 'AND P.nextUserIdx!=15'
                                        + ' ' + 'AND G.createdTime<' +'\'' + '2021-11-05 23:33:59' +'\''
                                        + ' ' + 'ORDER BY G.createdTime DESC'
                                        + ' ' + 'LIMIT 4'
                      + ';';
  */                    
  // 게임 리스트에서 참여하기 누르면 안되는 문제 관련. JY 해결. 
  //query_MyGameList = 'SELECT H.gameIdx, G.createdTime, P.tossedTime, P.turnNumber, P.maxTurn, P.userIdx, P.nextUserIdx, P.imageUrl'
  query_MyGameList = 'SELECT H.gameIdx, G.createdTime, P.tossedTime, (P.turnNumber+1), P.maxTurn, P.userIdx, P.nextUserIdx, P.imageUrl'
                      + ' ' + 'FROM GameHistoryTable AS H'
                            + ' ' + 'INNER JOIN GameTable AS G ON H.gameIdx = G.gameIdx'
                            + ' ' + 'INNER JOIN GameCurrentTable AS C ON G.gameIdx = C.gameIdx'
                            + ' ' + 'INNER JOIN GameProgressTable AS P ON C.progressIdx = P.progressIdx'
                                  + ' ' + 'WHERE H.userIdx=' + intUserIdx
                                        + ' ' + 'AND G.status=' + intStatus
                                        + ' ' + 'AND P.nextUserIdx!=' + intUserIdx
                                        + ' ' + 'AND G.createdTime<' +'\'' + reqTimeStamp +'\''
                                        + ' ' + 'ORDER BY G.createdTime DESC'
                                        + ' ' + 'LIMIT ' + intReqNumOfGames
                      + ';';


  //console.log(query_MyGameList);
  //return;
  
  //-------------------------------------------------------------------------
  // 1.B DB 접근.
  // 
  //-------------------------------------------------------------------------
  try{

    queryResult = await queryThisFromTheTable(query_MyGameList);

    //console.log("------");
    //console.log(queryResult);


    const intResultNum = queryResult.length;

    const return_body = {
                          userIdx: intUserIdx, 
                          gameStatus: intStatus,
                          numOfGames: intResultNum,
                          myGames: queryResult
                        };

    // 그냥 리스폰스 일원화.                         
    return sendRes(200, return_body);



  }catch(error)
  {

    const err_msg ="[GetBestPicList] [Error] [Ing Game] SELECT FAIL. DB Access or etc.: " 
            + "event: " + JSON.stringify(event)
            + " > " + error;
    console.log( err_msg );                    
    return sendRes(400, err_msg);    

  }

  }else if( intStatus == 2 )
  {
  //-------------------------------------------------------------------------
  // 2.A [완료된 경우] 
  //   : 리퀘스트 파람으로 온 사용자도 했고, "완료된" 게임의 경우 쿼리문. 
  //
  // 2021.11.18: 제한적 쿼리문. 레이팅 정보는 아직 쿼리 안함. 
  //             왜? 레이팅 종합정보 테이블 아직 내용이 없어서. 
  //-------------------------------------------------------------------------
  /*
  # 2021.11.18. 이제, 다끝난 게임 + 키워드 해당언어로 추가 + 최종 이미지 주소.
  SELECT H.gameIdx, G.createdTime, G.endTime, G.turnCount, L.lang, L.localizedKeyword, P.imageUrl 
    FROM GameHistoryTable AS H 
      INNER JOIN GameTable AS G ON H.gameIdx = G.gameIdx 
      INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx 
      INNER JOIN GameProgressTable AS P ON H.progressIdx = P.progressIdx 
          WHERE H.userIdx=15 
              AND G.keywordLanguage=L.lang 
              AND G.status=2 
              AND G.endTime<'2021-11-16 23:33:59' ORDER BY G.endTime DESC LIMIT 4;  
  */
  /*
  query_MyGameList = 'SELECT H.gameIdx, G.createdTime, G.endTime, G.turnCount, L.lang, L.localizedKeyword, P.imageUrl'
                      + ' ' + 'FROM GameHistoryTable AS H'
                            + ' ' + 'INNER JOIN GameTable AS G ON H.gameIdx = G.gameIdx'
                            + ' ' + 'INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx'
                            + ' ' + 'INNER JOIN GameProgressTable AS P ON H.progressIdx = P.progressIdx '
                                  + ' ' + 'WHERE H.userIdx=' + intUserIdx
                                        + ' ' + 'AND G.keywordLanguage=L.lang'
                                        + ' ' + 'AND G.status=' + intStatus
                                        + ' ' + 'AND G.endTime<' +'\'' + reqTimeStamp +'\''
                                        + ' ' + 'ORDER BY G.endTime DESC'
                                        + ' ' + 'LIMIT ' + intReqNumOfGames
                      + ';';
  */                      
  
  //console.log(query_MyGameList);
  //return;

  //-------------------------------------------------------------------------
  // 2.A+ [NEW 완료된 경우] 
  //   : 리퀘스트 파람으로 온 사용자도 했고, "완료된" 게임의 경우 쿼리문. 
  //   : 리퀘스트 파람으로 온 온사용자가 그 해당 게임에 대해서, 레이팅 3종 했는지와, 
  //     그 각각의 게임에 대한 레이팅 스코어 3종세트(일단 더미 2021.11.25) 를 리스폰스함. 
  //
  // 2021.11.18: 제한적 쿼리문. 레이팅 정보는 아직 쿼리 안함. 
  //             왜? 레이팅 종합정보 테이블 아직 내용이 없어서. 
  // 2021.11.25: 내가 레이팅했는지 않했는지는 가져오고, 종합 카운트(스코어)는 아직 더미. 
  //-------------------------------------------------------------------------
  /*
  # 2021.11.25. 이제, 다끝난 게임 + 키워드 해당언어로 추가 + 최종 이미지 주소 + 레이팅 3종세트. + 레이팅 스코어 3종 세트. (게임이 끝나고 레이팅 정보가 없으면 리스팅 안된다!)
  // 이 쿼리, 중복참여한 게임은, 중복으로 나와서 못씀. 
  SELECT H.gameIdx, G.createdTime, G.endTime, G.turnCount, L.lang, L.localizedKeyword, P.imageUrl, R.checkedFun, R.checkedGoldhand, R.checkedReport, S.funScore, S.goldHandScore 
    FROM GameHistoryTable AS H 
      INNER JOIN GameTable AS G ON H.gameIdx = G.gameIdx 
      INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx 
      INNER JOIN GameProgressTable AS P ON H.progressIdx = P.progressIdx 
      INNER JOIN RatingStatusTable AS R ON H.gameIdx = R.gameIdx 
      INNER JOIN ScoreCountTable AS S ON H.gameIdx = S.gameIdx 
          WHERE H.userIdx=15 
              AND G.keywordLanguage=L.lang 
        AND G.status=2 
              AND G.endTime<'2021-11-16 23:33:59' ORDER BY G.endTime DESC LIMIT 4;  
  */
    // 토스게임쪽 수정하고 해야한다!

  // 2021.11.30. Got it! 토스 게임쪽 수정하러간다. 
  // 수정하고 돌아옴. 16:29
  
  //################################################################################
  // imageUrl 을 구하는 것은 쿼리 비용이 비싸다? 왜? 서브쿼리 써야해서?
  // 그래도 쓴다면.. SELECT progressIdx, imageUrl FROM GameProgressTable WHERE gameIdx=251 AND progressIdx=(SELECT MAX(progressIdx) FROM GameProgressTable);
  // 이것 참조. 단순히 조인해 보니 잘 안되네. 2021.11.30
  /*
  # 2021.11.30. 새로 만들자 쿼리문. #2
  # 토스게임에서 턴 종료되면 (힘들게) 레이팅스떼더스테이블에 종료된 게임을 유저인덱스와 함께 기록하므로 이걸 활용하자.
  SELECT G.gameIdx, G.createdTime, G.endTime, G.turnCount, L.lang, L.localizedKeyword, R.checkedFun, R.checkedGoldhand, R.checkedReport, S.funScore, S.goldHandScore 
        FROM GameTable AS G 
        INNER JOIN RatingStatusTable AS R ON R.gameIdx = G.gameIdx 
        INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx 
        INNER JOIN ScoreCountTable AS S ON S.gameIdx = G.gameIdx 
            WHERE R.userIdx=15 
                AND G.keywordLanguage=L.lang
                      AND G.endTime<'2021-11-30 23:51:59' ORDER BY G.endTime DESC LIMIT 4; 
  */
  /*
  query_MyGameList = 'SELECT G.gameIdx, G.createdTime, G.endTime, G.turnCount, L.lang, L.localizedKeyword, R.checkedFun, R.checkedGoldhand, R.checkedReport, S.funScore, S.goldHandScore'
  + ' ' + 'FROM GameTable AS G'
        + ' ' + 'INNER JOIN RatingStatusTable AS R ON R.gameIdx = G.gameIdx'
        + ' ' + 'INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx'
        + ' ' + 'INNER JOIN ScoreCountTable AS S ON S.gameIdx = G.gameIdx'
              + ' ' + 'WHERE R.userIdx=' + intUserIdx
                    + ' ' + 'AND G.keywordLanguage=L.lang'
                    + ' ' + 'AND G.endTime<' +'\'' + reqTimeStamp +'\''
                    + ' ' + 'ORDER BY G.endTime DESC'
                    + ' ' + 'LIMIT ' + intReqNumOfGames
  + ';';
  */
  //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // 2021.12.02. 주님과 동행하며 주님 주신 지혜로 해결한 쿼리문. 
  /*
  SELECT H.gameIdx, G.createdTime, G.endTime, G.turnCount, L.lang, L.localizedKeyword, R.checkedFun, R.checkedGoldhand, R.checkedReport, S.funScore, S.goldHandScore, P.imageUrl 
		FROM GameHistoryTable AS H 
			INNER JOIN GameTable AS G ON G.gameIdx = H.gameIdx 
            INNER JOIN GameProgressTable AS P ON H.progressIdx = P.progressIdx 
            INNER JOIN ScoreCountTable AS S ON S.gameIdx = G.gameIdx 
            INNER JOIN RatingStatusTable AS R ON R.gameIdx = G.gameIdx 
            INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx 
                WHERE G.status=2 
                    AND H.userIdx=15 
                    AND R.userIdx=15 
                    AND G.keywordLanguage=L.lang 
                    AND G.endTime<'2021-11-30 23:51:59' ORDER BY G.endTime DESC LIMIT 4;               
  */
  // 여기서 그림 주소는, 자신이 참여해서 그렸던 그것이 표시되는 것. 
  // 내가 참여한 목록 보는 것이니, 내가 한 그림/글 장면 보는 것이 맞는 것 같다~ 다른 사람이 한 것은 들어가야 보이는 것이 호기심 들게 함~
  query_MyGameList = 'SELECT H.gameIdx, G.createdTime, G.endTime, G.turnCount, L.lang, L.localizedKeyword, R.checkedFun, R.checkedGoldhand, R.checkedReport, S.funScore, S.goldHandScore, P.imageUrl'
  + ' ' + 'FROM GameHistoryTable AS H'
        + ' ' + 'INNER JOIN GameTable AS G ON G.gameIdx = H.gameIdx'
        + ' ' + 'INNER JOIN GameProgressTable AS P ON H.progressIdx = P.progressIdx'
        + ' ' + 'INNER JOIN ScoreCountTable AS S ON S.gameIdx = G.gameIdx'
        + ' ' + 'INNER JOIN RatingStatusTable AS R ON R.gameIdx = G.gameIdx'
        + ' ' + 'INNER JOIN LocalizedKeywordTable AS L ON G.keywordIdx = L.keywordIdx'
              + ' ' + 'WHERE G.status=' + intStatus
                    + ' ' + 'AND H.userIdx=' + intUserIdx
                    + ' ' + 'AND R.userIdx=' + intUserIdx
                    + ' ' + 'AND G.keywordLanguage=L.lang'
                    + ' ' + 'AND G.endTime<' +'\'' + reqTimeStamp +'\''
                    + ' ' + 'ORDER BY G.endTime DESC'
                    + ' ' + 'LIMIT ' + intReqNumOfGames
  + ';';

  //console.log(query_MyGameList);
    

  //-------------------------------------------------------------------------
  // 2.B DB 접근.
  // 
  //-------------------------------------------------------------------------
  try{

    queryResult = await queryThisFromTheTable(query_MyGameList);

    //console.log("------");
    //console.log(queryResult);

    const intResultNum = queryResult.length;

    /*
    const return_body = {
                          userIdx: intUserIdx, 
                          gameStatus: intStatus,
                          numOfGames: intResultNum,
                          myGames: queryResult
                        };
    */
    const return_body = {
                          bestGames: queryResult
                        };

    // 그냥 리스폰스 일원화.                         
    return sendRes(200, return_body);



  }catch(error)
  {
    const err_msg ="[GetBestPicList] [Error] [Finished Game] SELECT FAIL. DB Access or etc.: " 
            + "event: " + JSON.stringify(event)
            + " > " + error;
    console.log( err_msg );                    
    return sendRes(400, err_msg); 
  }


  }else 
  {
  //-------------------------------------------------------------------------
  // 게임이 만들기만 하고 토스가 한번도 되지 않았거나 ==  0, 뭔가 이상이 있는 경우
  // 0==일단만들어짐(첫토스이전), 1==진행중, 2==완료, 3==드롭, 4==뭔가 문제? 
  // CreateGame 람다 참조. 
  // 현재는 2021.11.18 이경우는 그냥 다 에러로 리스폰스. 
  //-------------------------------------------------------------------------
    const err_msg ="[GetBestPicList] [Error] Not supported GameStatus type! Ask to JO! : "
          + "event: " + JSON.stringify(event);
    console.log( err_msg );                    
    return sendRes(410, err_msg);   
  }




  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
