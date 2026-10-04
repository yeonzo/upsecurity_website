# Campfire 홈페이지

정적 페이지(`index.html`, `css/`, `js/`, `assets/`)와 접수 API(`api/lead.js`)를 **하나의 Vercel 프로젝트**로 배포합니다. 베타 사전예약과 도입 문의는 같은 도메인의 `/api/lead`로 전송되고, 서버리스 함수가 Amazon SES로 `subw04@gmail.com`에 메일을 보냅니다. 브라우저에는 AWS 자격 증명이나 메일 비밀번호를 넣지 않습니다.

## 구조

| 경로 | 설명 |
| --- | --- |
| `index.html`, `css/`, `js/`, `assets/` | 정적 사이트. Vercel이 그대로 서빙합니다. |
| `api/lead.js` | Vercel 서버리스 함수. `/api/lead` 경로로 자동 연결됩니다. |
| `lib/lead.js` | 검증·메일 본문·SES 전송 로직. 함수와 테스트가 함께 사용합니다. |
| `thanks.html`, `api/respond.js`, `lib/respond.js` | 콜드메일 버튼이 여는 `/thanks` 감사 페이지와 기록 중계 API. 서버에서 Apps Script 웹 앱(`doPost`)에 버튼 응답과 '관심 있어요' 팝업의 의견을 기록합니다. Apps Script를 **새 배포**해서 주소가 바뀌면 Vercel 환경 변수 `APPS_SCRIPT_URL`에 새 주소를 넣습니다. |
| `intro.html`, `api/reserve.js`, `lib/reserve.js` | QR 전용 소개 페이지 `/intro`(홈페이지에서 링크하지 않음). 유튜브 홍보영상이 끝나면 기업/개인 사전예약 팝업을 띄우고, 신청은 콜드메일과 별개인 Apps Script(`festa_opinion`) 시트의 `사전예약` 탭에 기록합니다. 그 웹 앱 주소는 `lib/reserve.js`의 `DEFAULT_RESERVE_SCRIPT_URL` 또는 Vercel 환경 변수 `RESERVE_SCRIPT_URL`에 넣습니다. QR 주소에 `?src=코드`를 붙이면 `유입` 칸에 남습니다. |
| `vercel.json` | 함수 설정과 정적 파일 캐시 헤더. |
| `.vercelignore` | `tests/`, `ver2/`, `ver3/` 등 배포에서 제외할 항목. |
| `tests/` | `node --test` 단위 테스트. AWS에 연결하지 않습니다. |

## 배포

1. [Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html)에서 발신 주소 또는 도메인을 검증합니다. SES 샌드박스 상태라면 수신 주소 `subw04@gmail.com`도 검증해야 합니다.
2. SES 전송 전용 IAM 사용자를 만들고 액세스 키를 발급합니다. 권한은 검증한 발신 주소에 대한 `ses:SendEmail` 하나면 충분합니다.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": "ses:SendEmail",
       "Resource": "arn:aws:ses:ap-northeast-2:<계정ID>:identity/<발신주소>"
     }]
   }
   ```

3. Vercel에서 이 저장소를 가져옵니다(Framework Preset: **Other**, 빌드 명령 없음). 프로젝트 **Settings → Environment Variables**에 다음을 Production·Preview 모두 등록합니다.

   | 이름 | 값 |
   | --- | --- |
   | `SENDER_EMAIL` | SES에서 검증한 발신 주소 |
   | `SES_REGION` | SES를 사용하는 리전 (예: `ap-northeast-2`) |
   | `SES_ACCESS_KEY_ID` | 2번에서 만든 액세스 키 |
   | `SES_SECRET_ACCESS_KEY` | 2번에서 만든 비밀 액세스 키 |

   Vercel 함수는 AWS Lambda 위에서 실행되므로 `AWS_ACCESS_KEY_ID` 같은 `AWS_` 접두사 이름은 예약어라 등록할 수 없습니다. 위의 `SES_` 이름을 그대로 사용하세요.

4. `main`에 푸시하면 Vercel이 정적 파일과 함수를 함께 배포합니다. 별도의 S3·CloudFront·API Gateway·SAM 배포는 필요 없습니다.
5. 배포된 주소에서 베타 신청과 도입 문의를 각각 한 번씩 시험합니다. 접수 메일이 `subw04@gmail.com`에 도착해야 합니다. 실패하면 Vercel 함수 로그에서 **오류 종류만** 확인하고, SES 발신 주소 검증·샌드박스 상태·리전을 점검합니다.

프런트엔드는 같은 출처의 `/api/lead`를 호출하므로 CORS 설정이 필요 없습니다.

## 로컬 실행

```bash
npm install
npx vercel dev        # 정적 페이지 + /api/lead 함께 실행
```

환경 변수는 `vercel env pull`로 받아오거나 `.env`에 직접 넣습니다(`.env`는 커밋하지 않습니다). `SENDER_EMAIL`이 없으면 API는 503을 반환하고 폼은 접수 완료로 표시하지 않습니다. 정적 파일만 볼 때는 `python3 -m http.server 8000`도 되지만 `/api/lead`는 동작하지 않습니다.

## 점검

```bash
npm test
```

테스트는 AWS에 연결하거나 실제 메일을 보내지 않습니다. 공개 전에 개인정보처리방침과 보관·파기 기준을 확정해 게시해야 합니다. 현재 푸터의 개인정보처리방침은 '추후 공개' 상태입니다. 또한 공개 접수 API에 대한 CAPTCHA·속도 제한 등 스팸 방어를 운영 환경에 맞게 검토하세요.
