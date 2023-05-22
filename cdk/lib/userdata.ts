import * as fs from "fs";

export function getUserData(
  ssmParameterPath: string = "AmazonCloudWatch-linux-httpd/demo-config"
): Array<string> {
  const userDataLines: Array<string> = fs
    .readFileSync("lib/user_data.sh", "utf8")
    .toString()
    .split("\n");

  userDataLines.push(
    `sed -i 's#AllowOverride None#AllowOverride All#' /etc/httpd/conf/httpd.conf`,
    `mkdir -p /var/www/html/public`,
    `echo "<?php phpinfo();?>" > /var/www/html/public/index.php`,
    `sed -i 's#DocumentRoot "/var/www/html"#DocumentRoot "/var/www/html/public"#' /etc/httpd/conf/httpd.conf`,
    `sed -e 's/DirectoryIndex.*/DirectoryIndex index.html index.php/' -i /etc/httpd/conf/httpd.conf`,
    `touch /var/www/html/public/index.html`,
    `echo "<!DOCTYPE html> <html> <head> <title>Demo</title> </head> <body> <h2>Home</h2><a href=\"/test.html\">Link</a><br/><a href=\"/non-existant\">Broken link</a></body></html>" >> /var/www/html/public/index.html`,
    `touch /var/www/html/public/test.html`,
    `echo "<!DOCTYPE html> <html> <head> <title>Demo</title> </head> <body> <h2>Test Page</h2><a href=\"/\">back</a></body></html>" >> /var/www/html/public/index.html`,
    `amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c ssm:${ssmParameterPath} -s`,
    `service httpd start`,
    `chkconfig httpd on`
  );

  return userDataLines;
}
