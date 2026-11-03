-- MySQL dump 10.13  Distrib 8.4.13, for Linux (x86_64)
--
-- Host: localhost    Database: healthwise
-- ------------------------------------------------------
-- Server version	8.4.13

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointments` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `physio_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `end_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_min` int NOT NULL,
  `slot_count` int NOT NULL DEFAULT '1',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason_code` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `package_consumed` tinyint(1) NOT NULL DEFAULT '0',
  `note` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `walk_in` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `ix_appointments_physio_time` (`physio_id`,`start_at`,`end_at`,`status`),
  KEY `ix_appointments_branch_time` (`branch_id`,`start_at`),
  KEY `ix_appointments_patient` (`patient_id`),
  KEY `ix_appointments_invoice` (`invoice_id`),
  KEY `fk_appointments_service` (`service_id`),
  CONSTRAINT `fk_appointments_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_appointments_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `fk_appointments_physio` FOREIGN KEY (`physio_id`) REFERENCES `physios` (`id`),
  CONSTRAINT `fk_appointments_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
INSERT INTO `appointments` VALUES ('06a02b84-468b-41f5-96e5-9c1652fa073b','br-kor','pt-ananya','ph-neha','svc-consult','2026-10-24T14:47:23.208Z','2026-10-24T15:17:23.208Z',30,1,'CHECKED_IN','WAITING',NULL,NULL,0,'',1),('0810f7c2-fc41-48ed-8340-73785e481626','br-kor','pt-ananya','ph-aisha','svc-exercise','2026-11-06T07:45:00.000Z','2026-11-06T09:15:00.000Z',90,2,'BOOKED',NULL,NULL,NULL,0,'',0),('41c55745-f4d8-42e7-9645-0265092096c8','br-kor','pt-ananya','ph-aisha','svc-consult','2026-11-01T08:30:00.000Z','2026-11-01T09:00:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('45a203ec-cba4-44c4-966a-b81e5b720f35','br-kor','pt-meera','ph-neha','svc-consult','2026-11-04T08:30:00.000Z','2026-11-04T09:00:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('5122848c-4278-4724-adea-db2643f9c936','br-kor','pt-ananya','ph-neha','svc-consult','2026-11-04T03:00:00.000Z','2026-11-04T03:30:00.000Z',30,1,'CANCELLED',NULL,'PATIENT_REQUEST',NULL,0,'',0),('65b1033c-43b1-484d-94a0-004d654d05b3','br-kor','pt-ananya','ph-neha','svc-consult','2026-10-24T13:30:00.000Z','2026-10-24T14:00:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('8f2631a5-bf83-4c15-b97e-79769fa9a869','br-kor','pt-ananya','ph-vikram','svc-consult','2026-11-04T04:30:00.000Z','2026-11-04T05:00:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('abd44e21-4273-4372-abcc-5112fce00098','br-kor','pt-rohan','ph-vikram','svc-consult','2026-11-03T08:30:00.000Z','2026-11-03T09:00:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-ananya','br-kor','pt-ananya','ph-neha','svc-consult','2026-10-14T03:30:00.000Z','2026-10-14T04:00:00.000Z',30,1,'COMPLETED','DONE',NULL,NULL,1,'tested and dlkanzp pepfzmv wpejdvpojr wmspvjeropfdmsv p]wreqjfmsd opw]jremfdsvcjr ewm]pfdsvc\'jre\'mfdsvcjokrmedscxjl',0),('apt-arjun','br-ind','pt-arjun','ph-suresh','svc-exercise','2026-10-14T06:00:00.000Z','2026-10-14T06:45:00.000Z',45,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-fatima','br-kor','pt-fatima','ph-aisha','svc-consult','2026-10-14T05:30:00.000Z','2026-10-14T06:00:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-kabir','br-kor','pt-kabir','ph-neha','svc-consult','2026-10-14T10:00:00.000Z','2026-10-14T10:30:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-meera','br-kor','pt-meera','ph-vikram','svc-manual','2026-10-14T04:30:00.000Z','2026-10-14T05:10:00.000Z',40,1,'IN_SERVICE','IN_SERVICE',NULL,NULL,0,'',0),('apt-next-ananya-neha','br-kor','pt-ananya','ph-neha','svc-consult','2026-11-02T04:30:00.000Z','2026-11-02T05:00:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-next-ananya-suresh','br-ind','pt-ananya','ph-suresh','svc-exercise','2026-11-02T09:30:00.000Z','2026-11-02T10:15:00.000Z',45,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-next-fatima-suresh','br-ind','pt-fatima','ph-suresh','svc-consult','2026-11-06T06:30:00.000Z','2026-11-06T07:00:00.000Z',30,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-next-meera-vikram','br-kor','pt-meera','ph-vikram','svc-manual','2026-11-03T05:30:00.000Z','2026-11-03T06:10:00.000Z',40,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-next-rohan-neha','br-kor','pt-rohan','ph-neha','svc-exercise','2026-11-05T10:30:00.000Z','2026-11-05T11:15:00.000Z',45,1,'BOOKED',NULL,NULL,NULL,0,'',0),('apt-past-1','br-kor','pt-rohan','ph-vikram','svc-consult','2026-10-13T03:30:00.000Z','2026-10-13T04:00:00.000Z',30,1,'COMPLETED','DONE',NULL,'inv-fatima',0,'Session completed. Home advice given.',0),('apt-past-2','br-kor','pt-meera','ph-aisha','svc-consult','2026-10-12T04:30:00.000Z','2026-10-12T05:00:00.000Z',30,1,'COMPLETED','DONE',NULL,'inv-past-2',0,'Session completed. Home advice given.',0),('apt-past-3','br-kor','pt-kabir','ph-neha','svc-consult','2026-10-11T05:30:00.000Z','2026-10-11T06:00:00.000Z',30,1,'COMPLETED','DONE',NULL,'inv-past-3',0,'Session completed. Home advice given.',0),('apt-past-4','br-kor','pt-fatima','ph-vikram','svc-consult','2026-10-10T06:30:00.000Z','2026-10-10T07:00:00.000Z',30,1,'COMPLETED','DONE',NULL,'inv-past-4',0,'Session completed. Home advice given.',0),('apt-past-5','br-kor','pt-ananya','ph-aisha','svc-consult','2026-10-09T07:30:00.000Z','2026-10-09T08:00:00.000Z',30,1,'COMPLETED','DONE',NULL,'inv-past-5',0,'Session completed. Home advice given.',0),('apt-past-6','br-kor','pt-rohan','ph-neha','svc-consult','2026-10-08T02:30:00.000Z','2026-10-08T03:00:00.000Z',30,1,'COMPLETED','DONE',NULL,'inv-past-6',0,'Session completed. Home advice given.',0),('apt-past-7','br-kor','pt-meera','ph-vikram','svc-consult','2026-10-07T03:30:00.000Z','2026-10-07T04:00:00.000Z',30,1,'COMPLETED','DONE',NULL,'inv-past-7',0,'Session completed. Home advice given.',0),('apt-past-8','br-kor','pt-kabir','ph-aisha','svc-consult','2026-10-06T04:30:00.000Z','2026-10-06T05:00:00.000Z',30,1,'COMPLETED','DONE',NULL,'inv-past-8',0,'Session completed. Home advice given.',0),('apt-rohan','br-kor','pt-rohan','ph-neha','svc-exercise','2026-10-14T04:00:00.000Z','2026-10-14T04:45:00.000Z',45,1,'CHECKED_IN','WAITING',NULL,NULL,0,'',0),('fa5565dc-7175-4a07-afdb-605a5f27f0ed','br-kor','pt-ananya','ph-neha','svc-exercise','2026-11-05T04:15:00.000Z','2026-11-05T06:30:00.000Z',135,3,'BOOKED',NULL,NULL,NULL,0,'',0);
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_events`
--

DROP TABLE IF EXISTS `audit_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_events` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outcome` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `correlation_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pos` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_audit_branch` (`branch_id`,`pos`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_events`
--

LOCK TABLES `audit_events` WRITE;
/*!40000 ALTER TABLE `audit_events` DISABLE KEYS */;
INSERT INTO `audit_events` VALUES ('04d9c64b-27ea-469d-a3d8-262777533a90','2026-11-02T11:52:08.981Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-rohan','SUCCESS',NULL,9),('0517c2eb-3567-4d32-a92e-29f1508d0967','2026-10-24T14:44:22.590Z','portal:pt-ananya','Ananya Rao','PATIENT_LOGIN','br-kor','patient','pt-ananya','SUCCESS',NULL,54),('07741430-0583-4720-9d08-b544079c9b66','2026-11-02T11:50:02.862Z','usr-staff','Leela D\'Souza','INVOICE_POSTED','br-kor','invoice','ec1669ed-9d2c-49a7-9b6b-fe9ccc70b3dc','SUCCESS','425330ad-dc6a-48ea-b86e-0bd307176ffa',15),('14749913-5022-4e49-98c5-cd4fee8ef231','2026-10-24T14:34:52.930Z','usr-org','Priya Shah','LOGIN','br-kor','session','f460cfa0-3f86-4063-85de-4a8fa51fb75c','SUCCESS',NULL,56),('19376019-6d26-4055-a091-1e049dbd3af3','2026-11-02T11:47:38.579Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,22),('1fa0f76f-e482-4986-969c-8160f4a5becc','2026-11-02T13:15:51.390Z','usr-staff','Leela D\'Souza','LOGIN','br-kor','session','15cd74d6-0d85-4d05-a823-1852c9e83240','SUCCESS',NULL,8),('20ff3efd-2dd3-4731-8298-8ff90a2d702a','2026-11-02T11:48:10.753Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,21),('227ed377-ccce-4791-9e3d-539fd034ba1c','2026-11-02T11:49:16.718Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,17),('24763576-a1f8-4195-95d5-9308a4f4be63','2026-11-03T09:41:46.978Z','usr-org','Priya Shah','LOGIN','br-kor','session','b57343d2-f770-4b79-80f4-222d3a814815','SUCCESS',NULL,3),('295c322a-42f2-44db-81a9-2b56d369b80e','2026-11-02T11:47:33.230Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,23),('2a89367d-67ba-46a2-9929-1a3e4cd22352','2026-11-01T07:33:32.070Z','usr-org','Priya Shah','LOGIN','br-kor','session','c8d06502-9f1c-4602-8f05-d0c28a98be74','SUCCESS',NULL,50),('2c2b94fa-6cb6-4d98-a413-4cc6ed1bf62f','2026-10-14T10:53:00.454Z','usr-org','Priya Shah','PHONE_REVEAL','br-kor','patient','pt-ananya','SUCCESS','38b13028-743e-466e-b210-ca525ced8176',63),('2e525751-19c1-403c-9c36-0293bdbd9fcd','2026-11-02T11:47:27.789Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,24),('2e989d5e-7cd5-46fe-9a9e-7bc2d18169e4','2026-11-02T11:35:17.531Z','usr-org','Priya Shah','LOGIN','br-kor','session','8cb82d8b-c203-49a4-b8e9-e5b00e2180d1','SUCCESS',NULL,42),('2eb7f27a-84eb-4e97-9993-eeccdcaea9f1','2026-11-02T11:49:18.637Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,16),('304b801e-34d2-4404-8e58-8dba411e6c4a','2026-11-02T11:48:59.851Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,20),('367275b8-a321-48f0-a4b0-48b4cea4b031','2026-11-02T11:49:11.947Z','usr-staff','Leela D\'Souza','LOGIN','br-kor','session','a697815f-8f41-4c1d-b704-ced9278ef5d1','SUCCESS',NULL,19),('42762ef4-245c-4ffd-8931-63e7e310f4f3','2026-11-02T11:46:24.583Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,30),('4649e142-3dda-4671-89e3-8a109a4662a5','2026-11-02T11:52:07.556Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-rohan','SUCCESS',NULL,10),('51c5807b-3043-44b1-844d-3131344f282c','2026-10-24T14:29:07.863Z','usr-org','Priya Shah','LOGIN','br-kor','session','282e9a66-0251-41b5-864c-9e87a378ffb5','SUCCESS',NULL,58),('52fe91e4-e59f-4652-8e6a-c43ab1a2ce36','2026-10-14T10:52:59.650Z','usr-org','Priya Shah','PHONE_REVEAL','br-kor','patient','pt-ananya','SUCCESS','0d3e502a-336c-4d78-9ae2-060a6f87a2ae',64),('5357d571-4101-4680-9573-24730c900d67','2026-10-24T14:47:23.208Z','usr-org','Priya Shah','WALK_IN','br-kor','appointment','06a02b84-468b-41f5-96e5-9c1652fa073b','SUCCESS','fb9e3e5b-2f23-4e73-b1c6-7a631fea91bc',52),('53708062-5a4a-4828-80ab-90c35e1a2c28','2026-10-14T10:53:01.350Z','usr-org','Priya Shah','PHONE_REVEAL','br-kor','patient','pt-ananya','SUCCESS','a037e518-6ac6-4bbd-9246-b32a36dc993f',62),('6025b3de-3ab1-4d9e-990d-e38fc13d30ca','2026-11-01T07:47:26.915Z','portal:pt-ananya','Ananya Rao','APPOINTMENT_BOOKED','br-kor','appointment','5122848c-4278-4724-adea-db2643f9c936','SUCCESS','c4888447-8435-4e57-9dab-e9764174db65',48),('646b91b0-7e94-4b07-bb6a-c6851763c536','2026-11-02T11:46:48.764Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,28),('67ddd948-f83a-456e-afd1-a83f748d1c55','2026-11-02T11:43:04.953Z','usr-org','Priya Shah','APPOINTMENT_BOOKED','br-kor','appointment','45a203ec-cba4-44c4-966a-b81e5b720f35','SUCCESS','af75eff9-83cf-4536-89c5-87a6dc467148',41),('6c512237-c6a3-4a57-b3c9-5cecad90affe','2026-11-03T09:45:33.851Z','usr-staff','Leela D\'Souza','LOGIN','br-kor','session','8f911337-aa70-42c7-ab18-896e2cc01db8','SUCCESS',NULL,0),('723bb78e-ea40-40a7-9ebf-200d2e319892','2026-11-02T11:50:27.741Z','usr-staff','Leela D\'Souza','PAYMENT_RECORDED','br-kor','invoice','ec1669ed-9d2c-49a7-9b6b-fe9ccc70b3dc','SUCCESS','48abb038-b78c-4276-860a-15f9bf761e29',14),('7381804a-11af-42eb-a802-cd9cf6c11d1f','2026-11-02T11:46:18.255Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,31),('77fbfe0e-1ef0-48b8-bf0d-e50a42781790','2026-11-01T07:32:37.922Z','portal:pt-ananya','Ananya Rao','PATIENT_LOGIN','br-kor','patient','pt-ananya','SUCCESS',NULL,51),('7aef9e9d-4282-43a3-b4b8-296934cb5bfe','2026-11-02T11:44:21.933Z','usr-org','Priya Shah','PATIENT_CHART_READ','br-kor','patient','pt-kabir','SUCCESS',NULL,37),('7c8a08f4-08e5-4098-996f-9f19f72ebe1e','2026-11-02T11:29:21.522Z','portal:pt-ananya','Ananya Rao','APPOINTMENT_BOOKED','br-kor','appointment','8f2631a5-bf83-4c15-b97e-79769fa9a869','SUCCESS','e00cd977-a8b2-47d8-9167-629df89dbaaf',44),('8028ba53-c17c-477e-8027-ce1b3cdd6049','2026-11-02T11:51:37.159Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-rohan','SUCCESS',NULL,11),('81d356c5-4e34-427a-825c-38aae906095c','2026-11-03T09:11:29.470Z','portal:pt-ananya','Ananya Rao','APPOINTMENT_BOOKED','br-kor','appointment','fa5565dc-7175-4a07-afdb-605a5f27f0ed','SUCCESS','44396e4d-44d7-41f0-a01a-c4c0d9a5fa4b',5),('88e5d09c-7c71-4aef-88a6-ec70e22a5803','2026-10-24T14:39:44.802Z','usr-org','Priya Shah','REPORT_READ','br-kor','report','2026-10','SUCCESS',NULL,55),('8fad0d5b-bc97-476d-86d4-5d3fe78a269e','2026-11-02T11:46:15.364Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,32),('8ff43391-b3ab-4ec1-bf21-9251ccc354b8','2026-11-03T09:42:58.850Z','usr-staff','Leela D\'Souza','LOGIN','br-kor','session','505c4a26-e3fd-40dc-b5d8-af176bf7e727','SUCCESS',NULL,1),('90e2b1cf-015b-475c-82a3-3a43e2951cf6','2026-11-02T11:31:40.378Z','usr-org','Priya Shah','LOGIN','br-kor','session','8af3cd1b-6e99-4050-af3b-a139a4dd41a1','SUCCESS',NULL,43),('9425f588-ca31-4125-bfc4-67be9d009bfb','2026-11-01T07:48:12.215Z','portal:pt-ananya','Ananya Rao','APPOINTMENT_BOOKED','br-kor','appointment','41c55745-f4d8-42e7-9645-0265092096c8','SUCCESS','f2065f8c-704b-4240-b636-d0768ced598a',47),('948f1967-8fb6-4441-b74f-53b475fd6cee','2026-11-02T11:49:11.977Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,18),('98f94c7b-da60-4b85-8d67-07d2126b66a7','2026-10-14T11:43:26.915Z','usr-org','Priya Shah','LOGIN','br-kor','session','096073c1-e479-4490-91ed-bc376e5324fe','SUCCESS',NULL,59),('99fc4bab-a128-4160-8b69-63ad51f0c3e7','2026-10-14T10:52:47.455Z','usr-org','Priya Shah','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,65),('9b5c0f8f-b42c-427d-b0f7-e7ef28b84cea','2026-11-01T07:49:09.826Z','portal:pt-ananya','Ananya Rao','APPOINTMENT_CANCELLED','br-kor','appointment','5122848c-4278-4724-adea-db2643f9c936','SUCCESS','e67db3a9-8031-43cf-8d26-c7fad8595cca',46),('a46ddcc3-9252-4c45-ab76-89661f24bab5','2026-11-03T09:12:14.084Z','portal:pt-ananya','Ananya Rao','APPOINTMENT_BOOKED','br-kor','appointment','0810f7c2-fc41-48ed-8340-73785e481626','SUCCESS','19dc07f0-e6ae-4150-833b-6339bfa2790a',4),('a4d53e9d-28ab-47ff-a3c8-d52162a0b817','2026-10-14T10:48:20.853Z','usr-org','Priya Shah','LOGIN','br-kor','session','c2a71cd9-f659-4762-ab1b-e197941f99f8','SUCCESS',NULL,68),('a64288a8-5c22-440e-9c4a-bc369bab89a1','2026-11-02T11:47:27.775Z','usr-physio','Dr. Neha Kulkarni','PATIENT_UPDATED','br-kor','patient','pt-ananya','SUCCESS','c967f498-4112-4b7e-9221-587171a5bce6',25),('a76ee4ba-75c8-4119-b825-7c2e12cebaf5','2026-11-02T11:44:19.042Z','usr-org','Priya Shah','PATIENT_CHART_READ','br-kor','patient','pt-kabir','SUCCESS',NULL,38),('b05c9b90-3f71-457b-8f45-f101379bbe2f','2026-10-24T14:46:08.515Z','usr-org','Priya Shah','LOGIN','br-kor','session','aba177e6-d9f2-4842-a6e6-00bcbdb915a3','SUCCESS',NULL,53),('b36a1396-b855-4967-a2a1-130a3ebcbe60','2026-11-02T11:46:12.363Z','usr-physio','Dr. Neha Kulkarni','VISIT_COMPLETED','br-kor','appointment','apt-ananya','SUCCESS','f134d838-e9d9-4e97-908c-ca7c15e10db5',33),('b37792ba-ea01-4b77-8c3a-f4aaf2e5130e','2026-11-02T13:16:28.365Z','usr-org','Priya Shah','LOGIN','br-kor','session','ef5429d6-da70-4262-a433-945b60fcf8b9','SUCCESS',NULL,6),('b3e34dbf-d811-4da0-acbf-b518949f9f7f','2026-11-02T11:51:20.766Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-rohan','SUCCESS',NULL,13),('b77be40f-c192-499a-857a-9fc5c5156f2e','2026-11-02T11:46:54.304Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,27),('b929f22e-dcb1-4809-afdb-1195adc07375','2026-10-14T10:52:21.849Z','usr-org','Priya Shah','VISIT_STARTED','br-kor','appointment','apt-ananya','SUCCESS','b0b9dc7a-2725-496f-a9c2-6cd703410ae3',66),('b99b7c89-6cc8-4e1a-b3b0-3debe47b1929','2026-10-14T10:55:44.112Z','usr-branch','Arun Nair','LOGIN','br-kor','session','f1f97d5f-0a40-43be-a835-804f4294486c','SUCCESS',NULL,61),('c31165ba-4d94-4941-b1de-f34925ce1a14','2026-11-03T09:42:19.733Z','usr-staff','Leela D\'Souza','LOGIN','br-kor','session','5abfd98b-84c7-411d-8b16-b350ed6954c5','SUCCESS',NULL,2),('c8cf7bb7-e3a2-4f69-b4ae-ae2f6b835866','2026-11-02T11:44:16.390Z','usr-org','Priya Shah','PATIENT_CHART_READ','br-kor','patient','pt-kabir','SUCCESS',NULL,39),('ce7afecf-4960-4512-acd1-90ca195979d2','2026-11-02T11:45:20.526Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-kabir','SUCCESS',NULL,34),('d6b804df-1152-43e5-8537-3b06810bf0fb','2026-11-02T11:45:01.625Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-kabir','SUCCESS',NULL,35),('d6c34ea4-1d09-45c5-9991-ed83c0450f49','2026-11-02T11:47:08.968Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,26),('db228a9b-bbde-4b97-b847-7ede0a12cac1','2026-10-14T10:56:27.673Z','portal:pt-ananya','Ananya Rao','PATIENT_LOGIN','br-kor','patient','pt-ananya','SUCCESS',NULL,60),('de91fa81-a76a-4a1b-946b-a0e794371c6e','2026-11-02T11:51:33.592Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-rohan','SUCCESS',NULL,12),('dfcd8ee8-4134-4807-a6a4-50cf69226185','2026-11-02T11:45:01.594Z','usr-physio','Dr. Neha Kulkarni','LOGIN','br-kor','session','47297e60-d47d-49e2-b5be-772c23f432d2','SUCCESS',NULL,36),('edf2dfb4-391c-44bb-91e5-7eaafe73b602','2026-10-24T14:29:21.654Z','usr-org','Priya Shah','APPOINTMENT_BOOKED','br-kor','appointment','65b1033c-43b1-484d-94a0-004d654d05b3','SUCCESS','7695aa61-f669-4a76-a31c-862489ed9e1c',57),('ef61783e-3c5d-483f-b604-695675c63de0','2026-11-02T10:09:37.482Z','portal:pt-ananya','Ananya Rao','PATIENT_LOGIN','br-kor','patient','pt-ananya','SUCCESS',NULL,45),('f13a166f-4a9e-417f-b932-4ea2ebb25fa9','2026-11-02T13:15:59.122Z','usr-staff','Leela D\'Souza','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,7),('fb91df6e-ec5e-4cd4-8eab-e39ee7f6572a','2026-11-02T11:44:09.592Z','usr-org','Priya Shah','PATIENT_CHART_READ','br-kor','patient','pt-kabir','SUCCESS',NULL,40),('fc602f21-0990-45a6-a9f2-dabf4734671a','2026-11-01T07:34:31.660Z','usr-org','Priya Shah','APPOINTMENT_BOOKED','br-kor','appointment','abd44e21-4273-4372-abcc-5112fce00098','SUCCESS','c5230333-de16-42b7-906c-504729e2d5a8',49),('fd263ff1-9b5a-4d6d-bd4e-e5e6d9bfd1ff','2026-10-14T10:48:55.962Z','usr-org','Priya Shah','REPORT_READ','br-kor','report','2026-10','SUCCESS',NULL,67),('fdd254e8-df5b-40f7-b0b1-0838fcb0e154','2026-11-02T11:46:30.812Z','usr-physio','Dr. Neha Kulkarni','PATIENT_CHART_READ','br-kor','patient','pt-ananya','SUCCESS',NULL,29);
/*!40000 ALTER TABLE `audit_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `hours` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `parallel_therapy_capacity` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_branches_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES ('br-ind','BLR-IND','Indiranagar','Bengaluru','08:00–20:00',NULL),('br-kor','BLR-KOR','Koramangala','Bengaluru','08:00–20:00',NULL),('br-wfd','BLR-WFD','Whitefield','Bengaluru','09:00–19:00',NULL);
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES ('cat-consult','Consultation','CONSULT',1),('cat-package','Package','PACKAGE',1),('cat-therapy','Therapy','THERAPY',1);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `credit_notes`
--

DROP TABLE IF EXISTS `credit_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credit_notes` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(400) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_paise` int NOT NULL,
  `issued_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_credit_notes_invoice` (`invoice_id`),
  CONSTRAINT `fk_credit_notes_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `credit_notes`
--

LOCK TABLES `credit_notes` WRITE;
/*!40000 ALTER TABLE `credit_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `credit_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedback`
--

DROP TABLE IF EXISTS `feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedback` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `physio_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating` int NOT NULL,
  `comment` varchar(400) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `given_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feedback_appointment` (`appointment_id`),
  CONSTRAINT `fk_feedback_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedback`
--

LOCK TABLES `feedback` WRITE;
/*!40000 ALTER TABLE `feedback` DISABLE KEYS */;
/*!40000 ALTER TABLE `feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `idempotency_keys`
--

DROP TABLE IF EXISTS `idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `idempotency_keys` (
  `slot_key` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fingerprint` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `result_json` json NOT NULL,
  PRIMARY KEY (`slot_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `idempotency_keys`
--

LOCK TABLES `idempotency_keys` WRITE;
/*!40000 ALTER TABLE `idempotency_keys` DISABLE KEYS */;
INSERT INTO `idempotency_keys` VALUES ('book:1db441f2-654e-4962-9030-ae271ec02884','7aac629d220fa64cb798843f7d570e8c8434d59c7c5d7144c1f23eeda6f25840','{\"id\": \"abd44e21-4273-4372-abcc-5112fce00098\", \"end\": \"2026-11-03T09:00:00.000Z\", \"note\": \"\", \"start\": \"2026-11-03T08:30:00.000Z\", \"status\": \"BOOKED\", \"branchId\": \"br-kor\", \"physioId\": \"ph-vikram\", \"invoiceId\": null, \"patientId\": \"pt-rohan\", \"serviceId\": \"svc-consult\", \"branchName\": \"Koramangala\", \"physioName\": \"Dr. Vikram Desai\", \"reasonCode\": null, \"patientCode\": \"HW-10088\", \"patientName\": \"Rohan Rao\", \"phoneMasked\": \"98••••••45\", \"queueStatus\": null, \"serviceName\": \"Physiotherapy consultation\", \"packageConsumed\": false}'),('book:4652d1b7-c060-4ae7-b2ff-f44a37c23f12','18c670b8bb16835c97506296d7088e1df2fdf1a23bfad048f742911ca5c9674d','{\"id\": \"65b1033c-43b1-484d-94a0-004d654d05b3\", \"end\": \"2026-10-24T14:00:00.000Z\", \"note\": \"\", \"start\": \"2026-10-24T13:30:00.000Z\", \"status\": \"BOOKED\", \"branchId\": \"br-kor\", \"physioId\": \"ph-neha\", \"invoiceId\": null, \"patientId\": \"pt-ananya\", \"serviceId\": \"svc-consult\", \"branchName\": \"Koramangala\", \"physioName\": \"Dr. Neha Kulkarni\", \"reasonCode\": null, \"patientCode\": \"HW-10021\", \"patientName\": \"Ananya Rao\", \"phoneMasked\": \"98••••••45\", \"queueStatus\": null, \"serviceName\": \"Physiotherapy consultation\", \"packageConsumed\": false}'),('book:66be7eeb-7748-46e4-91d1-afd35039bf21','b6ccef623216cae38f33879b1b3ab97578deab27810f88c09d1cecb85791e972','{\"id\": \"41c55745-f4d8-42e7-9645-0265092096c8\", \"end\": \"2026-11-01T09:00:00.000Z\", \"note\": \"\", \"start\": \"2026-11-01T08:30:00.000Z\", \"status\": \"BOOKED\", \"branchId\": \"br-kor\", \"physioId\": \"ph-aisha\", \"invoiceId\": null, \"patientId\": \"pt-ananya\", \"serviceId\": \"svc-consult\", \"branchName\": \"Koramangala\", \"physioName\": \"Dr. Aisha Rahman\", \"reasonCode\": null, \"patientCode\": \"HW-10021\", \"patientName\": \"Ananya Rao\", \"phoneMasked\": \"98••••••45\", \"queueStatus\": null, \"serviceName\": \"Physiotherapy consultation\", \"packageConsumed\": false}'),('book:778c5236-022c-4e32-a24c-940c28988636','bb1ac5380a2fbeb27f76c47776c19929c9ebbd5aeea7c8bb021eac7c3bb95d2f','{\"id\": \"45a203ec-cba4-44c4-966a-b81e5b720f35\", \"end\": \"2026-11-04T09:00:00.000Z\", \"note\": \"\", \"start\": \"2026-11-04T08:30:00.000Z\", \"status\": \"BOOKED\", \"branchId\": \"br-kor\", \"physioId\": \"ph-neha\", \"invoiceId\": null, \"patientId\": \"pt-meera\", \"serviceId\": \"svc-consult\", \"branchName\": \"Koramangala\", \"physioName\": \"Dr. Neha Kulkarni\", \"reasonCode\": null, \"patientCode\": \"HW-10042\", \"patientName\": \"Meera Iyer\", \"phoneMasked\": \"99••••••56\", \"queueStatus\": null, \"serviceName\": \"Physiotherapy consultation\", \"packageConsumed\": false}'),('book:80a3e98c-ea35-42f8-9984-9c04a5713ea7','4ca4366bf6fb0ec9eaa0ccb10ed5db53ec72baf55fc60272b574e6fc5627bd99','{\"id\": \"5122848c-4278-4724-adea-db2643f9c936\", \"end\": \"2026-11-04T03:30:00.000Z\", \"note\": \"\", \"start\": \"2026-11-04T03:00:00.000Z\", \"status\": \"BOOKED\", \"branchId\": \"br-kor\", \"physioId\": \"ph-neha\", \"invoiceId\": null, \"patientId\": \"pt-ananya\", \"serviceId\": \"svc-consult\", \"branchName\": \"Koramangala\", \"physioName\": \"Dr. Neha Kulkarni\", \"reasonCode\": null, \"patientCode\": \"HW-10021\", \"patientName\": \"Ananya Rao\", \"phoneMasked\": \"98••••••45\", \"queueStatus\": null, \"serviceName\": \"Physiotherapy consultation\", \"packageConsumed\": false}'),('book:db4daf34-ef15-42cb-b325-7587459114b3','eeed9a69f644ebbf66ec95db427355424fd802fac0a0bb546e550096f8feddc6','{\"id\": \"fa5565dc-7175-4a07-afdb-605a5f27f0ed\", \"end\": \"2026-11-05T06:30:00.000Z\", \"note\": \"\", \"start\": \"2026-11-05T04:15:00.000Z\", \"status\": \"BOOKED\", \"branchId\": \"br-kor\", \"physioId\": \"ph-neha\", \"invoiceId\": null, \"patientId\": \"pt-ananya\", \"serviceId\": \"svc-exercise\", \"slotCount\": 3, \"branchName\": \"Koramangala\", \"physioName\": \"Dr. Neha Kulkarni\", \"reasonCode\": null, \"durationMin\": 135, \"patientCode\": \"HW-10021\", \"patientName\": \"Ananya Rao\", \"phoneMasked\": \"98••••••45\", \"queueStatus\": null, \"serviceKind\": \"THERAPY\", \"serviceName\": \"Exercise therapy\", \"packageConsumed\": false}'),('book:e4f774ca-6aa9-4ef5-93ec-729769b557df','809649e8d7a0b0e770c4a33a5998b09b1c902f2954932373c8e24af8417acfe9','{\"id\": \"8f2631a5-bf83-4c15-b97e-79769fa9a869\", \"end\": \"2026-11-04T05:00:00.000Z\", \"note\": \"\", \"start\": \"2026-11-04T04:30:00.000Z\", \"status\": \"BOOKED\", \"branchId\": \"br-kor\", \"physioId\": \"ph-vikram\", \"invoiceId\": null, \"patientId\": \"pt-ananya\", \"serviceId\": \"svc-consult\", \"branchName\": \"Koramangala\", \"physioName\": \"Dr. Vikram Desai\", \"reasonCode\": null, \"patientCode\": \"HW-10021\", \"patientName\": \"Ananya Rao\", \"phoneMasked\": \"98••••••45\", \"queueStatus\": null, \"serviceName\": \"Physiotherapy consultation\", \"packageConsumed\": false}'),('book:f32204b8-6e77-4b0c-be2b-21ec29a4da5b','26246d0595f8cf3ff54ba144d6b3f6bc79fd3861d3767597ff993eded9ff22fe','{\"id\": \"0810f7c2-fc41-48ed-8340-73785e481626\", \"end\": \"2026-11-06T09:15:00.000Z\", \"note\": \"\", \"start\": \"2026-11-06T07:45:00.000Z\", \"status\": \"BOOKED\", \"branchId\": \"br-kor\", \"physioId\": \"ph-aisha\", \"invoiceId\": null, \"patientId\": \"pt-ananya\", \"serviceId\": \"svc-exercise\", \"slotCount\": 2, \"branchName\": \"Koramangala\", \"physioName\": \"Dr. Aisha Rahman\", \"reasonCode\": null, \"durationMin\": 90, \"patientCode\": \"HW-10021\", \"patientName\": \"Ananya Rao\", \"phoneMasked\": \"98••••••45\", \"queueStatus\": null, \"serviceKind\": \"THERAPY\", \"serviceName\": \"Exercise therapy\", \"packageConsumed\": false}'),('invoice:4a778cc2-5a68-4e49-a613-6bc3b530d812','f20e8474fe5e704c534099c04b7ad61a92cca135cdaf48f05a79aa46399e9646','{\"id\": \"ec1669ed-9d2c-49a7-9b6b-fe9ccc70b3dc\", \"lines\": [{\"qty\": 1, \"name\": \"Exercise therapy\", \"taxBps\": 1800, \"serviceId\": \"svc-exercise\", \"unitPaise\": 120000}], \"number\": \"KOR/2026-27/0008\", \"status\": \"POSTED\", \"gstMode\": \"REGULAR\", \"branchId\": \"br-kor\", \"duePaise\": 141600, \"postedAt\": \"2026-11-02T11:50:02.862Z\", \"taxPaise\": 21600, \"paidPaise\": 0, \"patientId\": \"pt-rohan\", \"totalPaise\": 141600, \"discountBps\": 0, \"patientCode\": \"HW-10088\", \"patientName\": \"Rohan Rao\", \"appointmentId\": null, \"discountPaise\": 0, \"subtotalPaise\": 120000}'),('pay:ec1669ed-9d2c-49a7-9b6b-fe9ccc70b3dc:e4e954bc-8893-4102-b1ce-b7cad2c1cc43','39190b1454272614b7db300b8513e12775621fc94501a8043218aa7514fd766d','{\"id\": \"ec1669ed-9d2c-49a7-9b6b-fe9ccc70b3dc\", \"lines\": [{\"qty\": 1, \"name\": \"Exercise therapy\", \"taxBps\": 1800, \"serviceId\": \"svc-exercise\", \"unitPaise\": 120000}], \"number\": \"KOR/2026-27/0008\", \"status\": \"PAID\", \"gstMode\": \"REGULAR\", \"branchId\": \"br-kor\", \"duePaise\": 0, \"postedAt\": \"2026-11-02T11:50:02.862Z\", \"taxPaise\": 21600, \"paidPaise\": 141600, \"patientId\": \"pt-rohan\", \"totalPaise\": 141600, \"discountBps\": 0, \"patientCode\": \"HW-10088\", \"patientName\": \"Rohan Rao\", \"appointmentId\": null, \"discountPaise\": 0, \"subtotalPaise\": 120000}');
/*!40000 ALTER TABLE `idempotency_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_appointments`
--

DROP TABLE IF EXISTS `invoice_appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_appointments` (
  `invoice_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pos` int NOT NULL,
  PRIMARY KEY (`invoice_id`,`appointment_id`),
  KEY `ix_invoice_appointments_appointment` (`appointment_id`),
  CONSTRAINT `fk_invoice_appointments_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  CONSTRAINT `fk_invoice_appointments_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_appointments`
--

LOCK TABLES `invoice_appointments` WRITE;
/*!40000 ALTER TABLE `invoice_appointments` DISABLE KEYS */;
INSERT INTO `invoice_appointments` VALUES ('inv-fatima','apt-past-1',0);
/*!40000 ALTER TABLE `invoice_appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_lines`
--

DROP TABLE IF EXISTS `invoice_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_lines` (
  `invoice_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `line_no` int NOT NULL,
  `service_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty` int NOT NULL,
  `unit_paise` int NOT NULL,
  `tax_bps` int NOT NULL,
  `appointment_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`invoice_id`,`line_no`),
  KEY `ix_invoice_lines_appointment` (`appointment_id`),
  CONSTRAINT `fk_invoice_lines_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_lines`
--

LOCK TABLES `invoice_lines` WRITE;
/*!40000 ALTER TABLE `invoice_lines` DISABLE KEYS */;
INSERT INTO `invoice_lines` VALUES ('ec1669ed-9d2c-49a7-9b6b-fe9ccc70b3dc',0,'svc-exercise','Exercise therapy',1,120000,1800,NULL),('inv-fatima',0,'svc-exercise','Exercise therapy',1,120000,1800,NULL);
/*!40000 ALTER TABLE `invoice_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_sequences`
--

DROP TABLE IF EXISTS `invoice_sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_sequences` (
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `seq` int NOT NULL,
  PRIMARY KEY (`branch_id`),
  CONSTRAINT `fk_sequences_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_sequences`
--

LOCK TABLES `invoice_sequences` WRITE;
/*!40000 ALTER TABLE `invoice_sequences` DISABLE KEYS */;
INSERT INTO `invoice_sequences` VALUES ('br-ind',2),('br-kor',8),('br-wfd',0);
/*!40000 ALTER TABLE `invoice_sequences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transaction_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gst_mode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount_bps` int NOT NULL DEFAULT '0',
  `subtotal_paise` int NOT NULL,
  `discount_paise` int NOT NULL,
  `tax_paise` int NOT NULL,
  `total_paise` int NOT NULL,
  `paid_paise` int NOT NULL DEFAULT '0',
  `posted_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoices_number` (`number`),
  KEY `ix_invoices_patient` (`patient_id`),
  KEY `ix_invoices_branch` (`branch_id`,`status`),
  CONSTRAINT `fk_invoices_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_invoices_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
INSERT INTO `invoices` VALUES ('ec1669ed-9d2c-49a7-9b6b-fe9ccc70b3dc','KOR/2026-27/0008','br-kor','pt-rohan',NULL,'','PAID','REGULAR',0,120000,0,21600,141600,141600,'2026-11-02T11:50:02.862Z'),('inv-fatima','KOR/2026-27/0007','br-kor','pt-fatima','apt-past-1','','POSTED','REGULAR',0,120000,0,21600,141600,50000,'2026-10-13T06:30:00.000Z');
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `last_error` varchar(240) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sent_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pos` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_notifications_branch` (`branch_id`,`pos`),
  KEY `fk_notifications_patient` (`patient_id`),
  CONSTRAINT `fk_notifications_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('08fc2929-3514-49ef-a65a-c9f9537d8c30','br-kor','pt-meera','WHATSAPP','BOOKING','SENT',1,'','2026-11-02T11:43:04.953Z',2),('2bebbd56-02d5-4084-a913-d2db02b6ecb7','br-kor','pt-ananya','WHATSAPP','BOOKING','SENT',1,'','2026-11-03T09:11:29.469Z',1),('33d9792a-f4aa-43aa-9b92-6fb79a0f4e4c','br-kor','pt-ananya','WHATSAPP','BOOKING','SENT',1,'','2026-11-01T07:47:26.915Z',6),('3c09b600-2570-4531-bdb6-aa74bbfdf2ab','br-kor','pt-ananya','WHATSAPP','BOOKING','SENT',1,'','2026-11-03T09:12:14.084Z',0),('4475cf8b-7a27-4896-84d8-ff1622e4cafb','br-kor','pt-ananya','WHATSAPP','BOOKING','SENT',1,'','2026-11-02T11:29:21.522Z',3),('b5f1cfc8-c039-4eb2-8428-6c6011547671','br-kor','pt-ananya','WHATSAPP','BOOKING','SENT',1,'','2026-11-01T07:48:12.215Z',5),('c3b273a7-9e43-4ea1-9a26-74156f6ac891','br-kor','pt-rohan','WHATSAPP','BOOKING','SENT',1,'','2026-11-01T07:34:31.660Z',7),('e124d0ef-de8a-4cd1-a537-030390a6d001','br-kor','pt-ananya','SMS','CANCELLED','SENT',1,'','2026-11-01T07:49:09.826Z',4),('fa7abbb0-e82d-48bb-9197-1e4f4cefed48','br-kor','pt-ananya','WHATSAPP','BOOKING','SENT',1,'','2026-10-24T14:29:21.654Z',8),('ntf-1','br-kor','pt-rohan','WHATSAPP','REMINDER','FAILED',2,'Provider timeout','2026-10-14T02:40:00.000Z',9),('ntf-2','br-kor','pt-ananya','SMS','BOOKING','SENT',1,'','2026-10-14T02:30:00.000Z',10);
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organization`
--

DROP TABLE IF EXISTS `organization`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gst_mode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gst_bps` int NOT NULL,
  `discount_cap_bps` int NOT NULL,
  `patient_booking` tinyint(1) NOT NULL DEFAULT '1',
  `public_ratings` tinyint(1) NOT NULL DEFAULT '1',
  `parallel_therapy_capacity` int NOT NULL DEFAULT '1',
  `schema_version` int NOT NULL DEFAULT '2',
  `calendar_demo` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organization`
--

LOCK TABLES `organization` WRITE;
/*!40000 ALTER TABLE `organization` DISABLE KEYS */;
INSERT INTO `organization` VALUES ('org-hw','HealthWise Physiotherapy','REGULAR',1800,1000,1,1,1,2,1);
/*!40000 ALTER TABLE `organization` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `package_prices`
--

DROP TABLE IF EXISTS `package_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `package_prices` (
  `package_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_paise` int NOT NULL,
  PRIMARY KEY (`package_id`,`branch_id`),
  KEY `fk_package_prices_branch` (`branch_id`),
  CONSTRAINT `fk_package_prices_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_package_prices_package` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `package_prices`
--

LOCK TABLES `package_prices` WRITE;
/*!40000 ALTER TABLE `package_prices` DISABLE KEYS */;
INSERT INTO `package_prices` VALUES ('pkg-posture','br-ind',460000),('pkg-posture','br-kor',420000),('pkg-posture','br-wfd',390000),('pkg-rehab','br-ind',880000),('pkg-rehab','br-kor',800000),('pkg-rehab','br-wfd',760000);
/*!40000 ALTER TABLE `package_prices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `packages`
--

DROP TABLE IF EXISTS `packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `packages` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `credits` int NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `category_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `packages`
--

LOCK TABLES `packages` WRITE;
/*!40000 ALTER TABLE `packages` DISABLE KEYS */;
INSERT INTO `packages` VALUES ('pkg-posture','Posture reset (4)',4,1,'cat-package'),('pkg-rehab','8-session rehab',8,1,'cat-package');
/*!40000 ALTER TABLE `packages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patients`
--

DROP TABLE IF EXISTS `patients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patients` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dob` char(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_minor` tinyint(1) NOT NULL DEFAULT '0',
  `flags` json NOT NULL,
  `guardian` json DEFAULT NULL,
  `merged_into` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` varchar(240) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `occupation` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `blood_group` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `referring_doctor` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `condition_text` varchar(240) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `affected_area` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pain_score` int DEFAULT NULL,
  `onset` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `precautions` varchar(240) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `emergency_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `emergency_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_patients_code` (`code`),
  KEY `ix_patients_phone` (`phone`),
  KEY `ix_patients_branch` (`branch_id`),
  KEY `ix_patients_name` (`name`),
  CONSTRAINT `fk_patients_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patients`
--

LOCK TABLES `patients` WRITE;
/*!40000 ALTER TABLE `patients` DISABLE KEYS */;
INSERT INTO `patients` VALUES ('pt-ananya','HW-10021','Ananya Rao','9845012345','Female','1992-04-18','br-kor',0,'[\"Package\"]',NULL,NULL,'','','','','','','',NULL,'','','',''),('pt-arjun','HW-10220','Arjun Menon','9744412340','Male','1998-02-14','br-ind',0,'[]',NULL,NULL,'','','','','','','',NULL,'','','',''),('pt-fatima','HW-10077','Fatima Khan','9888001122','Female','1978-09-30','br-kor',0,'[\"Dues\"]',NULL,NULL,'','','','','','','',NULL,'','','',''),('pt-kabir','HW-10103','Kabir Shah','9811122233','Male','2016-01-22','br-kor',1,'[\"Minor\"]','{\"name\": \"Leela Shah\", \"idType\": \"AADHAAR\", \"consent\": true, \"idLast4\": \"4321\"}',NULL,'','','','','','','',NULL,'','','',''),('pt-meera','HW-10042','Meera Iyer','9900123456','Female','1986-07-09','br-kor',0,'[]',NULL,NULL,'','','','','','','',NULL,'','','',''),('pt-rohan','HW-10088','Rohan Rao','9845012345','Male','1990-11-02','br-kor',0,'[\"Shared phone\"]',NULL,NULL,'','','','','','','',NULL,'','','','');
/*!40000 ALTER TABLE `patients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_methods_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
INSERT INTO `payment_methods` VALUES ('pm-card','CARD','Card',1),('pm-cash','CASH','Cash',1),('pm-upi','UPI','UPI',1);
/*!40000 ALTER TABLE `payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_paise` int NOT NULL,
  `paid_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_payments_invoice` (`invoice_id`),
  CONSTRAINT `fk_payments_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES ('d6d646e0-d33e-4ef0-b8c9-b1f39c5243f9','ec1669ed-9d2c-49a7-9b6b-fe9ccc70b3dc','UPI',141600,'2026-11-02T11:50:27.741Z'),('pay-fatima','inv-fatima','UPI',50000,'2026-10-13T06:40:00.000Z');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `physio_leave`
--

DROP TABLE IF EXISTS `physio_leave`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `physio_leave` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `physio_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_date` char(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_date` char(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pos` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_physio_leave_physio` (`physio_id`,`from_date`,`to_date`),
  CONSTRAINT `fk_leave_physio` FOREIGN KEY (`physio_id`) REFERENCES `physios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `physio_leave`
--

LOCK TABLES `physio_leave` WRITE;
/*!40000 ALTER TABLE `physio_leave` DISABLE KEYS */;
INSERT INTO `physio_leave` VALUES ('ph-aisha:2026-11-04:2026-11-04:0','ph-aisha','2026-11-04','2026-11-04','Demo leave',0);
/*!40000 ALTER TABLE `physio_leave` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `physios`
--

DROP TABLE IF EXISTS `physios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `physios` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `engagement` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `availability` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating_sum` int NOT NULL DEFAULT '0',
  `review_count` int NOT NULL DEFAULT '0',
  `gender` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `experience_years` int DEFAULT NULL,
  `consult_days` json NOT NULL,
  `consult_start` char(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consult_end` char(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parallel_therapy_capacity` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_physios_branch` (`branch_id`),
  CONSTRAINT `fk_physios_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `physios`
--

LOCK TABLES `physios` WRITE;
/*!40000 ALTER TABLE `physios` DISABLE KEYS */;
INSERT INTO `physios` VALUES ('ph-aisha','Dr. Aisha Rahman','EMPLOYEE','Neuro','br-kor','ON_BREAK',27,6,'','','',NULL,'[1, 2, 3, 4, 5, 6]','11:00','19:00',NULL),('ph-neha','Dr. Neha Kulkarni','EMPLOYEE','Musculoskeletal','br-kor','AVAILABLE',48,10,'','','',NULL,'[1, 2, 3, 4, 5, 6]','09:00','17:00',NULL),('ph-suresh','Dr. Suresh Babu','EMPLOYEE','Orthopaedic','br-ind','AVAILABLE',42,9,'','','',NULL,'[1, 2, 3, 4, 5, 6]','09:00','18:00',NULL),('ph-vikram','Dr. Vikram Desai','CONSULTANT','Sports','br-kor','AVAILABLE',36,8,'','','',NULL,'[1, 2, 3, 4, 5]','10:00','16:00',NULL);
/*!40000 ALTER TABLE `physios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchases`
--

DROP TABLE IF EXISTS `purchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchases` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `package_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `credits_total` int NOT NULL,
  `credits_left` int NOT NULL,
  `frozen` tinyint(1) NOT NULL DEFAULT '0',
  `expires_on` char(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_purchases_patient` (`patient_id`,`status`),
  KEY `fk_purchases_package` (`package_id`),
  KEY `fk_purchases_branch` (`branch_id`),
  CONSTRAINT `fk_purchases_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_purchases_package` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`),
  CONSTRAINT `fk_purchases_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchases`
--

LOCK TABLES `purchases` WRITE;
/*!40000 ALTER TABLE `purchases` DISABLE KEYS */;
INSERT INTO `purchases` VALUES ('pur-ananya','pt-ananya','pkg-rehab','br-kor',8,4,0,'2027-04-01','ACTIVE');
/*!40000 ALTER TABLE `purchases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_prices`
--

DROP TABLE IF EXISTS `service_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_prices` (
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_paise` int NOT NULL,
  PRIMARY KEY (`branch_id`,`service_id`),
  KEY `ix_service_prices_service` (`service_id`),
  CONSTRAINT `fk_service_prices_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_service_prices_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_prices`
--

LOCK TABLES `service_prices` WRITE;
/*!40000 ALTER TABLE `service_prices` DISABLE KEYS */;
INSERT INTO `service_prices` VALUES ('br-ind','svc-consult',90000),('br-ind','svc-electro',65000),('br-ind','svc-exercise',130000),('br-ind','svc-manual',160000),('br-kor','svc-consult',80000),('br-kor','svc-electro',60000),('br-kor','svc-exercise',120000),('br-kor','svc-manual',150000),('br-wfd','svc-consult',75000),('br-wfd','svc-electro',55000),('br-wfd','svc-exercise',110000),('br-wfd','svc-manual',140000);
/*!40000 ALTER TABLE `service_prices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `category_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duration_min` int NOT NULL,
  `min_duration_min` int NOT NULL,
  `duration_step_min` int NOT NULL,
  `max_duration_min` int NOT NULL,
  `max_slots` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `ix_services_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
INSERT INTO `services` VALUES ('svc-consult','Physiotherapy consultation','CONSULT',1,'cat-consult',30,30,30,30,1),('svc-electro','Electrotherapy','THERAPY',1,'cat-therapy',20,20,20,80,4),('svc-exercise','Exercise therapy','THERAPY',1,'cat-therapy',45,45,45,180,4),('svc-manual','Manual therapy','THERAPY',1,'cat-therapy',40,40,40,160,4);
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token` (`token`),
  KEY `ix_sessions_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('036818e2-8e8b-43cf-b5cc-e667dcf1be0e','0e2d4e709bb239e093972dddfbf9b8cac85b37d4087091f5','portal:pt-ananya','PATIENT','2026-11-01T07:32:37.921Z','pt-ananya'),('14998566-494a-4e83-a021-7275ff4a3d0d','f3e198b6f6c8e024b7ea5bb60a3514cbd5af7149bdca4294','portal:pt-rohan','PATIENT','2026-10-24T14:47:50.175Z','pt-rohan'),('23e0d026-36fe-4f72-b166-23132534f3e2','040669c1b98a62f26cc31e4915b066ab4476c7a813848a37','usr-org','ORG_ADMIN','2026-10-14T10:58:31.961Z',NULL),('505c4a26-e3fd-40dc-b5d8-af176bf7e727','f4580646e661ac7e7c9f45debb0b899c46820913046cc1b3','usr-staff','STAFF','2026-11-03T09:42:58.848Z',NULL),('811d2eab-be66-48e5-b59d-5ed3ca7f5425','0abcb4c21131621ed74b500b87b0c261c4fbbc4c978a6e27','usr-org','ORG_ADMIN','2026-11-03T09:45:52.800Z',NULL),('a697815f-8f41-4c1d-b704-ced9278ef5d1','2c662edc579a1ab7c64b728fa5903681627bd4816cec62a3','usr-staff','STAFF','2026-11-02T11:49:11.946Z',NULL),('c1fa4791-9fde-4f6e-8923-978f66fc77ff','ecd526c10d8b3e6f8205fbc8e2675a11022032176ff9a65a','usr-org','ORG_ADMIN','2026-10-14T11:48:03.248Z',NULL),('c7d05944-676d-4caa-b305-32139c52af88','249030db803700fcba77cda8a60b04a8b539231ca221aed1','usr-org','ORG_ADMIN','2026-10-14T11:21:04.562Z',NULL),('c8d06502-9f1c-4602-8f05-d0c28a98be74','c77c68e6dd1a689f3faf04b5b109e49d8e9dc773303b37f8','usr-org','ORG_ADMIN','2026-11-01T07:33:32.069Z',NULL),('e3d4ad10-44bf-4beb-964e-dd144771a42b','7a75062e46d71fe0879374137782afa8205f89c45769def1','usr-staff','STAFF','2026-10-14T10:45:12.060Z',NULL);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_branches`
--

DROP TABLE IF EXISTS `user_branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_branches` (
  `user_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pos` int NOT NULL,
  PRIMARY KEY (`user_id`,`branch_id`),
  KEY `ix_user_branches_branch` (`branch_id`),
  CONSTRAINT `fk_user_branches_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_user_branches_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_branches`
--

LOCK TABLES `user_branches` WRITE;
/*!40000 ALTER TABLE `user_branches` DISABLE KEYS */;
INSERT INTO `user_branches` VALUES ('usr-branch','br-kor',0),('usr-org','br-ind',1),('usr-org','br-kor',0),('usr-org','br-wfd',2),('usr-physio','br-kor',0),('usr-staff','br-kor',0);
/*!40000 ALTER TABLE `user_branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_salt` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `terms_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `physio_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('usr-branch','Arun Nair','arun.nair@healthwise.local','','BRANCH_ADMIN','065c42cfc089078cb18af00dba1beab2','6cb9abf3a449022a161e71cfcc465f47bdb06194b52044add9c899e77c93cf31',1,NULL,NULL),('usr-org','Priya Shah','priya.shah@healthwise.local','','ORG_ADMIN','065c42cfc089078cb18af00dba1beab2','6cb9abf3a449022a161e71cfcc465f47bdb06194b52044add9c899e77c93cf31',1,NULL,NULL),('usr-physio','Dr. Neha Kulkarni','neha.kulkarni@healthwise.local','','PHYSIO','065c42cfc089078cb18af00dba1beab2','6cb9abf3a449022a161e71cfcc465f47bdb06194b52044add9c899e77c93cf31',1,'ph-neha',NULL),('usr-staff','Leela D\'Souza','leela.reception@healthwise.local','','STAFF','065c42cfc089078cb18af00dba1beab2','6cb9abf3a449022a161e71cfcc465f47bdb06194b52044add9c899e77c93cf31',1,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `visits`
--

DROP TABLE IF EXISTS `visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `visits` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `physio_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `started_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completed_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_visits_appointment` (`appointment_id`),
  CONSTRAINT `fk_visits_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `visits`
--

LOCK TABLES `visits` WRITE;
/*!40000 ALTER TABLE `visits` DISABLE KEYS */;
INSERT INTO `visits` VALUES ('8ce8680d-1137-4577-a49e-de87a4d38151','apt-ananya','pt-ananya','ph-neha','br-kor','COMPLETED','tested and dlkanzp pepfzmv wpejdvpojr wmspvjeropfdmsv p]wreqjfmsd opw]jremfdsvcjr ewm]pfdsvc\'jre\'mfdsvcjokrmedscxjl','2026-10-14T10:52:21.849Z','2026-11-02T11:46:12.363Z'),('vis-meera','apt-meera','pt-meera','ph-vikram','br-kor','IN_SERVICE','','2026-10-14T04:32:00.000Z',NULL),('vis-past-1','apt-past-1','pt-rohan','ph-vikram','br-kor','COMPLETED','Session completed. Home advice given.','2026-10-13T03:30:00.000Z','2026-10-13T04:00:00.000Z'),('vis-past-2','apt-past-2','pt-meera','ph-aisha','br-kor','COMPLETED','Session completed. Home advice given.','2026-10-12T04:30:00.000Z','2026-10-12T05:00:00.000Z'),('vis-past-3','apt-past-3','pt-kabir','ph-neha','br-kor','COMPLETED','Session completed. Home advice given.','2026-10-11T05:30:00.000Z','2026-10-11T06:00:00.000Z'),('vis-past-4','apt-past-4','pt-fatima','ph-vikram','br-kor','COMPLETED','Session completed. Home advice given.','2026-10-10T06:30:00.000Z','2026-10-10T07:00:00.000Z'),('vis-past-5','apt-past-5','pt-ananya','ph-aisha','br-kor','COMPLETED','Session completed. Home advice given.','2026-10-09T07:30:00.000Z','2026-10-09T08:00:00.000Z'),('vis-past-6','apt-past-6','pt-rohan','ph-neha','br-kor','COMPLETED','Session completed. Home advice given.','2026-10-08T02:30:00.000Z','2026-10-08T03:00:00.000Z'),('vis-past-7','apt-past-7','pt-meera','ph-vikram','br-kor','COMPLETED','Session completed. Home advice given.','2026-10-07T03:30:00.000Z','2026-10-07T04:00:00.000Z'),('vis-past-8','apt-past-8','pt-kabir','ph-aisha','br-kor','COMPLETED','Session completed. Home advice given.','2026-10-06T04:30:00.000Z','2026-10-06T05:00:00.000Z');
/*!40000 ALTER TABLE `visits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'healthwise'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-03 10:18:44
