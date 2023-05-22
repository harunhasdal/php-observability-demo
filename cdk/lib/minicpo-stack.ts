import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elb from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import { cwConfig } from "./cwconfig";
import { getUserData } from "./userdata";

export class MiniCPOStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with 2 AZs, public, private, and isolated subnets
    const vpc = new ec2.Vpc(this, "vpc", {
      vpcName: "minicpo-vpc",
      maxAzs: 2,
      ipAddresses: ec2.IpAddresses.cidr("10.10.0.0/16"),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ingress",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "application",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: "rds",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      natGateways: 1,
    });

    // RDS mysql instance
    // const instanceIdentifier = "minicpodb01";
    // const creds = new rds.DatabaseSecret(this, "MiniCPODBCredentials", {
    //   secretName: `/${id}/rds/creds/${instanceIdentifier}`.toLowerCase(),
    //   username: "admin",
    // });
    // const db_mysql = new rds.DatabaseInstance(this, "minicpodb", {
    //   vpc,
    //   vpcSubnets: {
    //     onePerAz: true,
    //     subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    //   },
    //   databaseName: "minicpodb",
    //   instanceIdentifier: "minicpodb01",
    //   engine: rds.DatabaseInstanceEngine.mysql({
    //     version: rds.MysqlEngineVersion.VER_8_0,
    //   }),
    //   instanceType: ec2.InstanceType.of(
    //     ec2.InstanceClass.BURSTABLE3,
    //     ec2.InstanceSize.SMALL
    //   ),
    //   credentials: rds.Credentials.fromSecret(creds),
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    // });

    //create load balancer
    const alb = new elb.ApplicationLoadBalancer(this, "lb", {
      vpc,
      internetFacing: true,
      loadBalancerName: "minicpo-alb",
    });

    const listener = alb.addListener("lb80", {
      port: 80,
    });

    const linuxAMI = ec2.MachineImage.latestAmazonLinux2({
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
    });

    const asg = new autoscaling.AutoScalingGroup(this, "asg", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO
      ),
      role: new iam.Role(this, "minicporole", {
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonSSMManagedInstanceCore"
          ),
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "CloudWatchAgentAdminPolicy"
          ),
        ],
      }),
      machineImage: linuxAMI,
      desiredCapacity: 1,
      minCapacity: 1,
      maxCapacity: 3,
    });

    const cloudWatchConfigParameter = new ssm.StringParameter(
      this,
      "cwlogsconfig",
      {
        parameterName: "AmazonCloudWatch-linux-httpd/demo",
        description:
          "Cloudwatch logs agent configuration for httpd access logs and error logs",
        stringValue: JSON.stringify(cwConfig),
      }
    );

    const userDataLines = getUserData(cloudWatchConfigParameter.parameterName);

    asg.userData.addCommands(...userDataLines);

    const targetGroup = listener.addTargets("target", {
      port: 80,
      targets: [asg],
      healthCheck: {
        port: "80",
        healthyHttpCodes: "200-499",
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });

    alb.connections.allowFromAnyIpv4(ec2.Port.tcp(80), "Internet access ALB");
    asg.connections.allowFrom(alb, ec2.Port.tcp(80), "ALB to ASG");
    // db_mysql.connections.allowFrom(asg, ec2.Port.tcp(3306), "ASG to DB");

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: alb.loadBalancerDnsName,
    });
  }
}
