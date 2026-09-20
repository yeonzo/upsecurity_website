# Campfire 홈페이지 접수 API

홈페이지의 베타 사전예약과 도입 문의는 AWS API Gateway → Lambda → Amazon SES를 통해 `subw04@gmail.com`으로 전송됩니다. 메일이 SES에서 접수된 후에만 화면에 접수 완료가 표시됩니다. 브라우저에는 AWS 자격 증명이나 메일 비밀번호를 넣지 않습니다.

## AWS 배포

1. [Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html)에서 사용할 발신 주소 또는 도메인을 검증합니다. Lambda와 SES는 **같은 AWS 리전**에서 사용해야 합니다. SES 샌드박스 상태라면 수신 주소 `subw04@gmail.com`도 검증해야 하며, 운영 전 [프로덕션 액세스](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)를 신청하는 편이 좋습니다.
2. AWS 자격 증명과 [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)를 준비하고 저장소 루트에서 실행합니다.

   ```bash
   sam build
   sam deploy --guided
   ```

   `SiteOrigin`에는 홈페이지의 정확한 주소 원점(예: `https://www.example.com`, 끝에 `/` 없음), `SenderEmail`에는 SES에서 검증한 발신 주소를 입력합니다. IAM 역할 생성 안내가 나오면 표시된 권한을 확인한 뒤 승인합니다.
3. 배포 결과의 `LeadApiUrl` 값을 [index.html](index.html)의 `<meta name="campfire-lead-api" content="">`에 입력합니다. `SiteOrigin`은 실제 CloudFront 사이트 주소와 일치해야 합니다(예: `https://d123.cloudfront.net` 또는 연결한 사용자 도메인). 도메인이 바뀌면 SAM 스택의 `SiteOrigin`도 업데이트해야 합니다.
4. 정적 파일 **만** S3에 올리고 CloudFront 캐시를 무효화합니다. 아래의 자리표시자는 실제 버킷명·배포 ID로 바꿉니다.

   ```bash
   aws s3 cp index.html s3://YOUR_BUCKET/index.html --content-type text/html
   aws s3 sync css/ s3://YOUR_BUCKET/css/
   aws s3 sync js/ s3://YOUR_BUCKET/js/
   aws s3 sync assets/ s3://YOUR_BUCKET/assets/
   aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/index.html" "/js/*" "/css/*"
   ```

   `lambda/`, `tests/`, `template.yaml`, `.git/`, `package.json`은 S3에 올리지 않습니다. Ver.2·3을 별도 주소로 공개 중이라면 기존 배포 방식대로 그 정적 디렉터리만 따로 올리면 됩니다.
5. CloudFront 홈페이지에서 실제 베타 신청과 도입 문의를 각각 한 번씩 시험합니다. 정상 접수는 `subw04@gmail.com` 메일함에 도착해야 합니다. 실패하면 Lambda의 CloudWatch 로그에서 **오류 종류만** 확인하고, SES의 발신 주소 검증·샌드박스 상태·리전을 점검합니다.

기존 `python3 -m http.server 8000`은 정적 파일만 제공하므로 로컬에서 메타 태그를 비워 두면 `/api/lead`가 동작하지 않습니다. 배포된 `LeadApiUrl`을 메타 태그에 설정하면 `http://localhost:8000`에서도 API를 호출해 볼 수 있습니다. CloudFront에서 `/api/*` 요청을 API Gateway로 별도 라우팅한다면 메타 태그를 비워 두고 같은 출처(`/api/lead`)를 사용할 수도 있습니다.

## 점검

```bash
npm test
```

테스트는 AWS에 연결하거나 실제 메일을 보내지 않습니다. 공개 전에 개인정보처리방침과 보관·파기 기준을 확정해 게시해야 합니다. 현재 푸터의 개인정보처리방침은 '추후 공개' 상태입니다. 또한 공개 접수 API에 대한 CAPTCHA·강화된 속도 제한 등 스팸 방어를 운영 환경에 맞게 검토하세요.
