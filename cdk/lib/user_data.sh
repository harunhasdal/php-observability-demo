yum update -y
yum -y install ruby wget curl git httpd
yum -y install php82 php82-mysqlnd php82-pdo php82-mbstring php82-xml php82-pecl-memcached php82-gd php82-intl php82-imap php82-bcmath php82-soap php82-zip php82-opcache

# Install cloudwatch agent
yum -y install amazon-cloudwatch-agent

# Start cloudwatch agent
amazon-cloudwatch-agent-ctl -a start

# Get Composer, and install to /usr/local/bin
if [ ! -f "/usr/local/bin/composer" ]; then
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    php composer-setup.php --install-dir=/usr/bin --filename=composer
    php -r "unlink('composer-setup.php');"
else
    /usr/local/bin/composer self-update --stable --no-ansi --no-interaction
fi
