//-------------------------------------------------------------------------------------
// Project: SketchBird
// DB: mysql.
// 
// 사용자인덱스+게임인덱스 조합으로 저장된
// 좋아요, 금손, 신고 의 상태를 세팅하는, 바꾸는 람다.
// 
// 2021.11.11. sjjo. OLJ IAT. IWTLBTSFY
// 
// 2021.11.16. sjjo. The first deploy.
// 2021.11.23. sjjo. 스코어 카운트 테이블 +- 1 기능도 추가.
// 
//-------------------------------------------------------------------------------------
'use strict';

const mysql = require('mysql');


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
          console.log("[SetRatingStatus] [ERROR]: db-error:",err);
    });
    mysql_connection.end();
  });
}

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


module.exports.SetRatingStatus = async (event) => {

  //-------------------------------------------------------------------------
  // 0. 리퀘스트 파라메터 중에 값이 널인것 있는지 체크.
  //
  //-------------------------------------------------------------------------
  if( (event.gameIdx==null) || (event.userIdx==null) )
  {
    const err_msg = "[SetRatingStatus] [Serious Error!!] Invalid Request Data! event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }
  // 세팅할 파라메터가 셋다 null 이어도 에러 리스폰스. JY 협의. 
  if( (event.checkedFun==null) && (event.checkedGoldhand==null) && (event.checkedReport==null) )
  {
    const err_msg = "[SetRatingStatus] [Serious Error!!] Invalid Request Data! No data to set. event: " + JSON.stringify(event);
    console.log( err_msg );
    return sendRes(402, err_msg);
  }


//-------------------------------------------------------------------------
// 1. 인서트인 경우와 업데이트인 경우를 나눠서 생각해야 함.
//    처음 레이팅 하는 상황이라, 인서트 인 경우
//      : null인 필드는 0으로 채워서 인서트. 
//    레이팅 바꾸는 상황이라, 업데이트 하는 경우. 
//      : null인 필드는 건들지 않음. 
//-------------------------------------------------------------------------
  const intGameIdx = event.gameIdx;
  const intUserIdx = event.userIdx;

  const intCheckedFun = event.checkedFun;
  const intCheckedGoldhand = event.checkedGoldhand;
  const intCheckedReport = event.checkedReport;

  //------------------------------------------------------------
  // 2. 파라메터 유무별, 쿼리문 일부 만들기 로직.
  //    스코어카운트 테이블용 업데이트도 추가. 2021.11.23
  //------------------------------------------------------------
  let strQueryForInsert = null; // 널이면 0으로 채우기.
  let strQueryForUpdate = null; // 널이면 빼기.
  let strQueryForScoreUpdate = null; // (전체)스코어 테이블에 값을 +-1 하기 위한 쿼리문.

  if( intCheckedFun != null )
  {
      // [1번: nn, 2번: ?, 3번: ?]
      if( intCheckedGoldhand != null) 
      {
          // [1번: nn, 2번: nn, 3번: ?]
          if( intCheckedReport != null) 
          {
              // 셋다 널이 아닌 경우. 
              // [1번: nn, 2번: nn, 3번: nn]
              strQueryForInsert = ', ' + intCheckedFun + ', ' + intCheckedGoldhand + ', ' + intCheckedReport;
              strQueryForUpdate = 'checkedFun=' + intCheckedFun + ', checkedGoldhand=' + intCheckedGoldhand + ', checkedReport=' +intCheckedReport;

              // 스코어 테이블 +-1용 테이블. 셋다 널이 아니면, 이 값을 +-해줘야 한다는 얘기.
              if(intCheckedFun) strQueryForScoreUpdate = 'funScore=funScore+1';
              else strQueryForScoreUpdate = 'funScore=funScore-1';

              if(intCheckedGoldhand) strQueryForScoreUpdate += ', goldHandScore=goldHandScore+1';
              else strQueryForScoreUpdate += ', goldHandScore=goldHandScore-1';

              // 리포트도 해?? 2021.11.23_R

          }else
          {
              // 3번 필드만 널 인 경우. 
              // [1번: nn, 2번: nn, 3번: n]
              strQueryForInsert = ', ' + intCheckedFun + ', '+ intCheckedGoldhand + ', 0';
              strQueryForUpdate = 'checkedFun=' + intCheckedFun + ', checkedGoldhand=' + intCheckedGoldhand;

              // 스코어 테이블 +-1용 테이블. 3번 필드만 널이면, 이 값을 +-해줘야 한다는 얘기.
              if(intCheckedFun) strQueryForScoreUpdate = 'funScore=funScore+1';
              else strQueryForScoreUpdate = 'funScore=funScore-1';

              if(intCheckedGoldhand) strQueryForScoreUpdate += ', goldHandScore=goldHandScore+1';
              else strQueryForScoreUpdate += ', goldHandScore=goldHandScore-1';

              // 리포트도 해?? 2021.11.23_R : 널이니 안하는게 맞지.
          }
      }else
      {
          // [1번: nn, 2번: n, 3번: ?]
          if( intCheckedReport != null) 
          {
              // [1번: nn, 2번: n, 3번: nn]
              strQueryForInsert = ', ' + intCheckedFun + ', 0, ' + intCheckedReport;
              strQueryForUpdate = 'checkedFun=' + intCheckedFun+ ', checkedReport=' + intCheckedReport;

              // 스코어 테이블 +-1용 테이블. 
              if(intCheckedFun) strQueryForScoreUpdate = 'funScore=funScore+1';
              else strQueryForScoreUpdate = 'funScore=funScore-1';

              //if(intCheckedGoldhand) strQueryForScoreUpdate += ', goldHandScore=goldHandScore+1';
              //else strQueryForScoreUpdate += ', goldHandScore=goldHandScore-1';

              // 리포트도 해?? 2021.11.23_R

          }else
          {
              // [1번: nn, 2번: n, 3번: n]
              strQueryForInsert = ', ' + intCheckedFun + ', 0, 0';
              strQueryForUpdate = 'checkedFun=' + intCheckedFun;

              // 스코어 테이블 +-1용 테이블. 
              if(intCheckedFun) strQueryForScoreUpdate = 'funScore=funScore+1';
              else strQueryForScoreUpdate = 'funScore=funScore-1';

              //if(intCheckedGoldhand) strQueryForScoreUpdate += ', goldHandScore=goldHandScore+1';
              //else strQueryForScoreUpdate += ', goldHandScore=goldHandScore-1';

              // 리포트도 해?? 2021.11.23_R : 널이니 안하는게 맞지.
          }
      }      
  }else
  {
      // [1번: n, 2번: ?, 3번: ?]
      if( intCheckedGoldhand != null) 
      {
          // [1번: n, 2번: nn, 3번: ?]
          if( intCheckedReport != null) 
          {
              // [1번: n, 2번: nn, 3번: nn]
              strQueryForInsert = ', 0, ' + intCheckedGoldhand + ', ' + intCheckedReport;
              strQueryForUpdate = 'checkedGoldhand=' + intCheckedGoldhand+ ', checkedReport=' + intCheckedReport;

              // 스코어 테이블 +-1용 테이블. 
              //if(intCheckedFun) strQueryForScoreUpdate = 'funScore=funScore+1';
              //else strQueryForScoreUpdate = 'funScore=funScore-1';

              if(intCheckedGoldhand) strQueryForScoreUpdate = 'goldHandScore=goldHandScore+1';
              else strQueryForScoreUpdate = 'goldHandScore=goldHandScore-1';

              // 리포트도 해?? 2021.11.23_R

          }else
          {
              // [1번: n, 2번: nn, 3번: n]
              strQueryForInsert = ', 0, ' + intCheckedGoldhand + ', 0';
              strQueryForUpdate = 'checkedGoldhand=' + intCheckedGoldhand;

              // 스코어 테이블 +-1용 테이블. 
              //if(intCheckedFun) strQueryForScoreUpdate = 'funScore=funScore+1';
              //else strQueryForScoreUpdate = 'funScore=funScore-1';

              if(intCheckedGoldhand) strQueryForScoreUpdate = 'goldHandScore=goldHandScore+1';
              else strQueryForScoreUpdate = 'goldHandScore=goldHandScore-1';


          }
      }else
      {
          // [1번: n, 2번: n, 3번: ?]
          if( intCheckedReport != null) 
          {
              // [1번: n, 2번: n, 3번: nn]
              strQueryForInsert = ', 0, 0, ' + intCheckedReport;
              strQueryForUpdate = 'checkedReport=' + intCheckedReport;         
              
              // 리포트도 해?? 2021.11.23_R

          }else
          {
              // [1번: n, 2번: n, 3번: n]
              ;
              // 위에서 걸렀으니 이 경우는 안나오겠지. 
              // 하지만! 날리기. 혹시나.
              const err_msg = "[SetRatingStatus] [Serious Error!!] (in the logic) Invalid Request Data! No data to set. event: " + JSON.stringify(event);
              console.log( err_msg );
              return sendRes(402, err_msg);
          }
      }            
  }
  //------------------------------------------------------------


  //------------------------------------------------------------
  // 3. 최종 쿼리문 만들기. 
  //------------------------------------------------------------  
  let queryResult = null; 
  let TABLE_NAME = 'RatingStatusTable';
  const query_upsertRating = 'INSERT INTO ' + TABLE_NAME + ' '
                                      + '('
                                      + 'userIdx' /* 이게 이 테이블의 PK. 턴을 받을 사람 */
                                      + ', gameIdx'
                                      + ', checkedFun'
                                      + ', checkedGoldhand' 
                                      + ', checkedReport'
                                      + ') ' 

                                      + 'VALUES ('
                                      +  intUserIdx
                                      + ', ' + intGameIdx
                                      + strQueryForInsert
                                      + ') '

                                      + 'ON DUPLICATE KEY UPDATE '
                                      + strQueryForUpdate
                                      + ';'

  //console.log(query_upsertRating);          
  
  
  //------------------------------------------------------------
  // 4. 업서트 쿼리 실행. 
  //------------------------------------------------------------  
  try{

    queryResult= await queryThisFromTheTable(query_upsertRating);

  }catch(error)
  {
    const err_msg ="[SetRatingStatus] [Error] [RatingStatusTable] INSERT or UPDATE FAIL. DB Access or etc.: " 
                          + "event: " + JSON.stringify(event)
                          + " > " + error;
    console.log( err_msg );                    
    return sendRes(400, err_msg);
  }

  // console.log(queryResult);

  //------------------------------------------------------------
  // 5. 자신이 레이팅한 정보는 기록 완료했으니, ~~리스폰스 보내기.~~
  //------------------------------------------------------------    
  if(queryResult.warningCount == 0 )
  {

    /*
    // 정상 리스폰스 보냄.
    const response_data = {
      userIdx: intUserIdx, 
      gameIdx: intGameIdx, 
      message: "Rating the game for this user is successful."
    };

    return sendRes(200, response_data);
    */

  //------------------------------------------------------------
  // 6. 이제 전체 스코어 테이블에 카운트를 +1, -1 해야지. 2021.11.23
  //------------------------------------------------------------

  //------------------------------------------------------------
  // 6.1. 스테이트가 변화되는 그 시점에만 +-1 해야 함. 
  
  // UPDATE users SET reviews_len = reviews_len + 1 WHERE user_id = 1

    try{
      TABLE_NAME = 'ScoreCountTable';

      const query_EndGame_ScoreCountTable = 'UPDATE '  + TABLE_NAME + ' '
                                                  + 'SET ' 
                                                  + strQueryForScoreUpdate + ' '
                                                  + 'WHERE gameIdx=' + intGameIdx + ';'

      //console.log(query_EndGame_ScoreCountTable);

      queryResult = await queryThisFromTheTable(query_EndGame_ScoreCountTable);

      //---------------------------
      // (이제야) 정상 리스폰스 보냄.
      const response_data = {
        userIdx: intUserIdx, 
        gameIdx: intGameIdx, 
        message: "Rating the game for this user is successful."
      };

      return sendRes(200, response_data);      

    }catch(error){
      const errMsg = "[SetRatingStatus] [Error] [ScoreCountTable] UPDATE FAIL or DB Access. gameIdx: " + intGameIdx +  " > "  + error;
      console.log(errMsg); 
      return sendRes(400, errMsg);
    } 




  }else
  {
    // 워닝 카운트 있으므로 메시지와 함께 에러 토스. 
    const err_msg ="[SetRatingStatus] [WARNING!] [RatingStatusTable] Event: " 
                          + "event: " + JSON.stringify(event)
                          + ", Warning count: " + queryResult.warningCount
                          + ", Warning msg: " + queryResult.message;
    console.log( err_msg );                    
    return sendRes(412, err_msg);
  }



  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
