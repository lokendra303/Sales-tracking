-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 24, 2026 at 07:36 AM
-- Server version: 11.8.9-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u731120540_sepcune_dev`
--

-- --------------------------------------------------------

--
-- Table structure for table `beat`
--

CREATE TABLE `beat` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `assigneeId` int(11) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `territory` varchar(160) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `beat`
--

INSERT INTO `beat` (`id`, `tenantId`, `name`, `assigneeId`, `active`, `notes`, `createdAt`, `updatedAt`, `territory`) VALUES
(1, 1, 'E2E North 892352', 3, 1, NULL, '2026-10-16 19:28:12.965', '2026-10-16 19:28:12.965', 'Sector 12 test area'),
(2, 1, 'E2E North 053851', 3, 0, NULL, '2026-10-16 19:30:54.608', '2026-10-16 19:31:23.187', 'Sector 12 test area'),
(3, 4, 'testBeat', 11, 1, NULL, '2026-10-16 19:39:00.716', '2026-10-16 20:16:45.414', 'sector 18'),
(4, 4, 'test1', 11, 1, NULL, '2026-10-16 20:16:44.298', '2026-10-16 20:16:44.298', 'wdwfsdf'),
(5, 8, 'lodu', 19, 1, NULL, '2026-10-23 11:25:44.243', '2026-10-23 11:25:44.243', 'west delhi'),
(6, 8, 'hi', 20, 1, NULL, '2026-10-23 11:44:12.275', '2026-10-23 11:44:12.275', NULL),
(7, 4, 'test', 9, 1, NULL, '2026-10-24 07:13:24.264', '2026-10-24 07:13:24.264', 'sector 155'),
(8, 4, 'test2', 11, 1, NULL, '2026-10-24 07:14:38.786', '2026-10-24 07:14:38.786', 'test'),
(9, 4, 'test132', 11, 1, NULL, '2026-10-24 07:14:56.565', '2026-10-24 07:14:56.565', '2wesee');

-- --------------------------------------------------------

--
-- Table structure for table `beatmember`
--

CREATE TABLE `beatmember` (
  `id` int(11) NOT NULL,
  `beatId` int(11) NOT NULL,
  `leadId` int(11) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `sequence` int(11) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `beatmember`
--

INSERT INTO `beatmember` (`id`, `beatId`, `leadId`, `customerId`, `sequence`) VALUES
(1, 1, 13, NULL, 1),
(2, 2, 13, NULL, 1),
(4, 4, 17, NULL, 1),
(5, 4, 16, NULL, 2),
(6, 4, 20, NULL, 3),
(7, 4, 18, NULL, 4),
(9, 6, 24, NULL, 1),
(10, 5, 24, NULL, 1),
(11, 7, 15, NULL, 1),
(12, 7, 21, NULL, 2),
(13, 7, NULL, 3, 3);

-- --------------------------------------------------------

--
-- Table structure for table `beatplan`
--

CREATE TABLE `beatplan` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `cycleLength` int(11) NOT NULL DEFAULT 7,
  `startDate` date NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `beatplan`
--

INSERT INTO `beatplan` (`id`, `tenantId`, `userId`, `cycleLength`, `startDate`, `createdAt`, `updatedAt`) VALUES
(1, 1, 3, 7, '2026-10-17', '2026-10-16 19:18:25.211', '2026-10-16 19:31:02.575'),
(3, 1, 7, 7, '2026-10-16', '2026-10-16 19:18:28.484', '2026-10-16 19:18:28.484'),
(4, 4, 11, 7, '2026-10-17', '2026-10-16 19:38:38.323', '2026-10-16 21:52:51.643'),
(5, 4, 9, 7, '2026-10-17', '2026-10-16 20:17:24.044', '2026-10-16 20:17:24.044'),
(6, 4, 13, 7, '2026-10-17', '2026-10-16 20:17:37.263', '2026-10-16 20:17:37.263'),
(7, 4, 12, 7, '2026-10-17', '2026-10-16 20:17:38.402', '2026-10-16 20:17:38.402'),
(8, 6, 16, 7, '2026-10-21', '2026-10-21 07:46:20.514', '2026-10-21 07:46:20.514'),
(9, 8, 19, 7, '2026-10-23', '2026-10-23 11:25:27.168', '2026-10-23 11:25:27.168'),
(10, 8, 20, 7, '2026-10-23', '2026-10-23 11:43:48.586', '2026-10-23 11:47:03.978');

-- --------------------------------------------------------

--
-- Table structure for table `beatschedule`
--

CREATE TABLE `beatschedule` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `dayIndex` int(11) NOT NULL,
  `beatId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `beatschedule`
--

INSERT INTO `beatschedule` (`id`, `tenantId`, `userId`, `dayIndex`, `beatId`) VALUES
(2, 1, 3, 0, 2),
(3, 4, 11, 0, 4),
(4, 8, 20, 0, 6);

-- --------------------------------------------------------

--
-- Table structure for table `beatstop`
--

CREATE TABLE `beatstop` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `leadId` int(11) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `sequence` int(11) NOT NULL DEFAULT 1,
  `plannedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `beatId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `beatstop`
--

INSERT INTO `beatstop` (`id`, `tenantId`, `userId`, `leadId`, `customerId`, `sequence`, `plannedAt`, `createdAt`, `updatedAt`, `beatId`) VALUES
(1, 1, 3, 1, NULL, 1, '2026-09-24 05:30:00.000', '2026-09-24 08:58:19.637', '2026-09-24 08:58:19.637', NULL),
(2, 1, 3, 2, NULL, 2, '2026-09-24 06:30:00.000', '2026-09-24 08:58:19.661', '2026-09-24 08:58:19.661', NULL),
(3, 1, 3, 5, NULL, 1, '2026-09-25 04:30:00.000', '2026-09-24 10:41:06.807', '2026-09-24 10:41:06.807', NULL),
(4, 1, 3, 1, NULL, 2, '2026-09-25 05:30:00.000', '2026-09-24 10:41:29.214', '2026-09-24 10:41:29.214', NULL),
(5, 1, 3, 2, NULL, 3, '2026-09-25 06:30:00.000', '2026-09-24 10:41:29.281', '2026-09-24 10:41:29.281', NULL),
(6, 1, 7, 7, NULL, 1, '2026-09-27 04:30:00.000', '2026-09-26 11:22:59.326', '2026-09-26 11:22:59.326', NULL),
(7, 1, 7, 6, NULL, 2, '2026-09-27 05:30:00.000', '2026-09-26 11:23:05.966', '2026-09-26 11:23:05.966', NULL),
(8, 1, 7, 4, NULL, 3, '2026-09-27 06:30:00.000', '2026-09-26 11:23:08.863', '2026-09-26 11:23:08.863', NULL),
(9, 1, 3, 9, NULL, 1, '2026-09-27 04:30:00.000', '2026-09-26 11:23:19.136', '2026-09-26 11:23:19.136', NULL),
(10, 1, 3, 8, NULL, 2, '2026-09-27 05:30:00.000', '2026-09-26 11:23:20.450', '2026-09-26 11:23:20.450', NULL),
(11, 1, 7, 10, NULL, 1, '2026-10-04 04:30:00.000', '2026-10-03 08:32:18.736', '2026-10-03 08:32:18.736', NULL),
(12, 1, 3, 13, NULL, 1, '2026-10-17 04:30:00.000', '2026-10-16 19:31:08.248', '2026-10-16 19:31:08.248', 2),
(13, 4, 11, 17, NULL, 1, '2026-10-17 04:30:00.000', '2026-10-16 21:01:18.320', '2026-10-16 21:01:18.320', 4),
(14, 4, 11, 16, NULL, 2, '2026-10-17 05:30:00.000', '2026-10-16 21:01:18.332', '2026-10-16 21:01:18.332', 4),
(15, 4, 11, 20, NULL, 3, '2026-10-17 06:30:00.000', '2026-10-16 21:01:18.340', '2026-10-16 21:01:18.340', 4),
(16, 4, 11, 18, NULL, 4, '2026-10-17 07:30:00.000', '2026-10-16 21:01:18.347', '2026-10-16 21:01:18.347', 4),
(17, 4, 11, 17, NULL, 1, '2026-10-24 04:30:00.000', '2026-10-22 19:08:19.127', '2026-10-22 19:08:19.127', 4),
(18, 4, 11, 16, NULL, 2, '2026-10-24 05:30:00.000', '2026-10-22 19:08:19.141', '2026-10-22 19:08:19.141', 4),
(19, 4, 11, 20, NULL, 3, '2026-10-24 06:30:00.000', '2026-10-22 19:08:19.151', '2026-10-22 19:08:19.151', 4),
(20, 4, 11, 18, NULL, 4, '2026-10-24 07:30:00.000', '2026-10-22 19:08:19.158', '2026-10-22 19:08:19.158', 4),
(21, 8, 20, 24, NULL, 1, '2026-10-23 04:30:00.000', '2026-10-23 11:47:12.729', '2026-10-23 11:47:12.729', 6);

-- --------------------------------------------------------

--
-- Table structure for table `customer`
--

CREATE TABLE `customer` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `contactPerson` varchar(191) DEFAULT NULL,
  `businessType` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `city` varchar(191) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `gstin` varchar(191) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `ownerId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer`
--

INSERT INTO `customer` (`id`, `tenantId`, `name`, `phone`, `contactPerson`, `businessType`, `address`, `city`, `latitude`, `longitude`, `gstin`, `notes`, `ownerId`, `createdAt`, `updatedAt`) VALUES
(1, 1, 'XYZ Enterprises', '9876501234', 'Amit Shah', NULL, NULL, 'Noida', NULL, NULL, NULL, NULL, 3, '2026-09-24 08:39:19.295', '2026-09-24 08:39:19.295'),
(2, 1, 'ABC Traders', '9876543210', 'Rajesh Kumar', NULL, 'Connaught Place', 'Delhi', 28.6328000, 77.2197000, NULL, NULL, 3, '2026-09-24 11:48:00.543', '2026-09-24 11:48:00.543'),
(3, 4, 'Sepcune technology', '9190844291', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.4542916, 77.4547354, NULL, NULL, 11, '2026-10-16 21:04:35.023', '2026-10-16 21:04:35.023');

-- --------------------------------------------------------

--
-- Table structure for table `device`
--

CREATE TABLE `device` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `deviceUid` varchar(191) NOT NULL,
  `platform` varchar(191) NOT NULL DEFAULT 'android',
  `appVersion` varchar(191) DEFAULT NULL,
  `status` enum('ACTIVE','DEACTIVATED') NOT NULL DEFAULT 'ACTIVE',
  `lastSeenAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `pushToken` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `device`
--

INSERT INTO `device` (`id`, `userId`, `deviceUid`, `platform`, `appVersion`, `status`, `lastSeenAt`, `createdAt`, `updatedAt`, `pushToken`) VALUES
(1, 3, 'dev-phone-1', 'android', '0.1.0', 'ACTIVE', '2026-09-24 08:20:28.992', '2026-09-24 08:20:28.993', '2026-09-24 08:20:28.993', NULL),
(2, 3, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-12 19:59:43.315', '2026-09-24 08:28:59.597', '2026-10-12 19:59:43.316', NULL),
(3, 1, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-16 20:57:26.959', '2026-09-24 08:33:09.939', '2026-10-16 20:58:03.260', NULL),
(4, 2, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-09-24 08:52:59.368', '2026-09-24 08:33:29.847', '2026-09-24 08:52:59.370', NULL),
(5, 2, 'salestrack-web', 'web', NULL, 'ACTIVE', '2026-10-16 19:50:32.756', '2026-09-24 09:18:39.020', '2026-10-16 20:06:28.095', NULL),
(6, 3, 'salestrack-web', 'web', NULL, 'ACTIVE', '2026-09-26 07:57:03.550', '2026-09-24 09:19:14.983', '2026-09-26 07:57:03.552', NULL),
(7, 2, 'sprint6-web', 'android', NULL, 'ACTIVE', '2026-09-24 09:36:36.307', '2026-09-24 09:36:09.184', '2026-09-24 09:36:36.309', NULL),
(8, 3, 'sprint6-phone', 'android', NULL, 'ACTIVE', '2026-09-24 09:36:36.524', '2026-09-24 09:36:09.612', '2026-09-24 09:36:36.526', NULL),
(9, 2, 's7-web', 'web', NULL, 'ACTIVE', '2026-09-24 09:43:58.802', '2026-09-24 09:43:58.804', '2026-09-24 09:43:58.804', NULL),
(10, 3, 's7-phone', 'web', NULL, 'ACTIVE', '2026-09-24 09:43:59.175', '2026-09-24 09:43:59.177', '2026-09-24 09:43:59.177', NULL),
(11, 3, 's8-phone', 'android', NULL, 'ACTIVE', '2026-09-24 09:55:37.689', '2026-09-24 09:55:37.690', '2026-09-24 09:55:37.690', NULL),
(12, 1, 'salestrack-web', 'web', NULL, 'ACTIVE', '2026-10-24 07:18:31.294', '2026-09-24 10:56:05.582', '2026-10-24 07:19:12.527', NULL),
(13, 1, 'admin-web', 'web', NULL, 'ACTIVE', '2026-09-24 11:04:30.811', '2026-09-24 10:58:48.590', '2026-09-24 11:04:30.813', NULL),
(16, 2, 'mgr-web', 'web', NULL, 'ACTIVE', '2026-09-24 11:08:11.399', '2026-09-24 11:08:09.862', '2026-09-24 11:08:11.401', NULL),
(17, 3, 'sales-phone', 'android', NULL, 'ACTIVE', '2026-09-24 11:08:12.168', '2026-09-24 11:08:12.170', '2026-09-24 11:08:12.170', NULL),
(18, 7, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-10 23:07:21.918', '2026-09-26 11:26:08.003', '2026-10-10 23:07:21.920', NULL),
(19, 8, 'salestrack-web', 'web', NULL, 'ACTIVE', '2026-10-24 06:56:34.652', '2026-10-12 17:59:51.296', '2026-10-24 07:18:18.512', NULL),
(20, 9, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-13 08:22:55.573', '2026-10-12 20:01:33.431', '2026-10-13 08:22:55.573', NULL),
(21, 8, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-16 21:51:24.332', '2026-10-12 20:07:32.030', '2026-10-21 07:31:41.764', NULL),
(22, 11, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-24 07:07:14.506', '2026-10-13 08:44:49.114', '2026-10-24 07:07:14.506', NULL),
(23, 13, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-13 18:48:15.723', '2026-10-13 18:48:15.724', '2026-10-14 08:12:07.199', NULL),
(24, 1, 'diag', 'android', NULL, 'ACTIVE', '2026-10-15 09:01:16.275', '2026-10-15 09:01:16.276', '2026-10-15 09:01:16.276', NULL),
(25, 14, 'salestrack-web', 'web', NULL, 'ACTIVE', '2026-10-21 07:27:51.930', '2026-10-21 07:27:51.931', '2026-10-21 07:46:45.542', NULL),
(26, 15, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-21 07:32:11.488', '2026-10-21 07:32:11.490', '2026-10-24 07:06:53.040', NULL),
(27, 17, 'salestrack-web', 'web', NULL, 'ACTIVE', '2026-10-22 06:33:39.538', '2026-10-22 06:33:02.944', '2026-10-22 06:33:39.539', NULL),
(28, 18, 'salestrack-web', 'web', NULL, 'ACTIVE', '2026-10-24 06:54:54.642', '2026-10-23 11:20:19.878', '2026-10-24 06:56:09.673', NULL),
(29, 20, 'salestrack-dev', 'android', '0.1.0', 'ACTIVE', '2026-10-23 11:43:10.706', '2026-10-23 11:41:05.593', '2026-10-23 11:43:10.707', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `emailotp`
--

CREATE TABLE `emailotp` (
  `id` int(11) NOT NULL,
  `email` varchar(191) NOT NULL,
  `purpose` varchar(191) NOT NULL DEFAULT 'register',
  `codeHash` varchar(191) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `consumedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `emailotp`
--

INSERT INTO `emailotp` (`id`, `email`, `purpose`, `codeHash`, `expiresAt`, `attempts`, `consumedAt`, `createdAt`) VALUES
(1, 'lk.kushwah303@gmail.com', 'register', '86c35082b3deac146b76a884289caf3cdfa42e33e23e1410ce6ec259c885810e', '2026-10-13 06:22:09.474', 0, NULL, '2026-10-13 06:12:09.477'),
(2, 'lk.kushwah303@gmail.com', 'register', '38c861997014c7345c0f242c4b68a7179f7100ee6542894986e67b3f02eb03ff', '2026-10-13 06:23:41.134', 0, NULL, '2026-10-13 06:13:41.135'),
(3, 'lk.kushwah303@gmail.com', 'register', '9d70a85579f856383dd8ffe850d9506c003317483e9d7ef781157ccfd1292723', '2026-10-13 06:25:48.502', 0, NULL, '2026-10-13 06:15:48.504'),
(4, '2020aspire73@gmail.com', 'register', '03ae1d9c38f7016733c618d9405648c0a710d95ea9dbdc38b1b58554e4c7225a', '2026-10-13 06:26:55.529', 0, NULL, '2026-10-13 06:16:55.531'),
(5, 'lk.kushwah303@gmail.com', 'register', 'd2d7d83adaf627c603511dda77f1dbf9ef98b33637e224131e922cf9ed8fe17e', '2026-10-13 06:35:23.404', 0, NULL, '2026-10-13 06:25:23.405'),
(6, 'lk.kushwah303@gmail.com', 'reset_password', 'c477da796ac50b02e9834533e48b2526be78fa1ab94800a0ace22c744ca3f424', '2026-10-15 09:44:12.565', 0, '2026-10-15 11:46:50.318', '2026-10-15 09:34:12.567'),
(7, 'lk.kushwah303@gmail.com', 'reset_password', '1c4fa2b5d906e89f2dad3e60c40ff04d3a2826f57efd19ee5f92e069b0bc9130', '2026-10-15 11:54:25.638', 0, '2026-10-15 11:46:50.318', '2026-10-15 11:44:25.640'),
(8, 'lk.kushwah303@gmail.com', 'reset_password', 'd24c17c91f2fe1e0ae94eeb2d9ae9cb6f024fb2f3d8280b07bccb3507f564732', '2026-10-15 11:54:25.655', 1, '2026-10-15 11:46:50.318', '2026-10-15 11:44:25.656'),
(9, 'lk.kushwah303@gmail.com', 'reset_password', '20c82b1f08acd5ddee4f8e7aadc6c86dd6a98fcd2f5783e8462da34e84209b5a', '2026-10-15 11:56:51.179', 0, '2026-10-15 12:14:53.899', '2026-10-15 11:46:51.182'),
(10, 'lk.kushwah303@gmail.com', 'reset_password', '7018d7c2002fccac32a53651e83d0a6b4a76462a4d1e4c50f791d0d68d3835f9', '2026-10-15 12:24:53.913', 0, '2026-10-15 12:15:15.891', '2026-10-15 12:14:53.914'),
(11, 'lk.kushwah303@gmail.com', 'reset_password', '59cc5f94530053d08307debfcd4d89d92da6eee6c7523e9a2e3a66603fe078e6', '2026-10-15 12:25:15.893', 0, '2026-10-15 12:17:35.237', '2026-10-15 12:15:15.893'),
(12, 'lk.kushwah303@gmail.com', 'reset_password', 'f25ef7f675d25dd5cf62f2d2bfb99f006fd778e3d4120ef2da21802a5af47144', '2026-10-15 12:27:36.811', 0, '2026-10-15 13:02:19.871', '2026-10-15 12:17:36.814'),
(13, 'lk.kushwah303@gmail.com', 'reset_password', '203ff91252b12600252bca21566ad150b565378bd9531ba1fc5d174325385383', '2026-10-15 13:12:20.025', 0, '2026-10-15 13:02:58.876', '2026-10-15 13:02:20.027'),
(14, 'lk.kushwah303@gmail.com', 'delete_tenant_3', '267121d3c69f0a9a97526d3623ef83c015570ae70d8d68f0e8b9d430b070cdfc', '2026-10-16 20:50:04.520', 0, '2026-10-16 20:40:31.509', '2026-10-16 20:40:04.521'),
(15, 'lk.kushwah303@gmail.com', 'delete_tenant_2', '70be3c575b7cae197cd6561200f0b931c97b345981a6c729e97ed4af16197099', '2026-10-16 20:50:42.731', 0, '2026-10-16 20:41:26.928', '2026-10-16 20:40:42.731'),
(16, 'lk.kushwah303@gmail.com', 'delete_tenant_2', '1ebc01b86696abe866cde03a81ffb01e4f7cb6d42a228d8a8f6c49df1f9f5792', '2026-10-16 20:51:26.930', 1, '2026-10-16 20:42:05.771', '2026-10-16 20:41:26.931'),
(17, 'lk.kushwah303@gmail.com', 'reset_password', 'e0c5d305c6cac73c5f5a826f6a612686d68a96d0fa81134c2ffa66eac0d152d4', '2026-10-19 07:44:34.627', 0, NULL, '2026-10-19 07:34:34.628'),
(18, 'mayankrawat137@gmail.com', 'register', '677c9d13e5e44a4a551caee9221547c5b95e3b08314307f763bd949eceec1275', '2026-10-21 07:35:59.767', 0, '2026-10-21 07:27:32.446', '2026-10-21 07:25:59.768'),
(19, 'info@kamaxbeauty.com', 'register', 'bf485ad06c01c1e6d06e59f5328f319ae1faee07899e565aa7f5b0a4915d261b', '2026-10-22 06:40:57.781', 0, '2026-10-22 06:32:28.733', '2026-10-22 06:30:57.781'),
(20, 'rawatmayank691@gmail.com', 'register', '80a3e81e3bf04d4ba2cc2d5d7f87410711d187889f692cd033f5133a31889ca8', '2026-10-23 11:28:38.015', 0, '2026-10-23 11:19:36.569', '2026-10-23 11:18:38.017');

-- --------------------------------------------------------

--
-- Table structure for table `followup`
--

CREATE TABLE `followup` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `leadId` int(11) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `type` enum('CALL','VISIT','WHATSAPP') NOT NULL,
  `dueAt` datetime(3) NOT NULL,
  `doneAt` datetime(3) DEFAULT NULL,
  `notes` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `clientRequestId` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `followup`
--

INSERT INTO `followup` (`id`, `tenantId`, `userId`, `leadId`, `customerId`, `type`, `dueAt`, `doneAt`, `notes`, `createdAt`, `updatedAt`, `clientRequestId`) VALUES
(1, 1, 3, 1, NULL, 'CALL', '2026-09-24 09:30:00.000', NULL, 'Discuss order quantity', '2026-09-24 08:36:32.720', '2026-09-24 08:36:32.720', NULL),
(2, 1, 3, 2, NULL, 'CALL', '2026-09-25 08:39:19.410', NULL, 'Send details', '2026-09-24 08:39:19.440', '2026-09-24 08:39:19.440', NULL),
(3, 1, 3, 2, NULL, 'VISIT', '2026-09-25 04:30:00.000', '2026-09-26 11:17:35.900', 'Shop closed', '2026-09-24 08:59:38.177', '2026-09-26 11:17:35.902', NULL),
(4, 1, 3, 5, NULL, 'CALL', '2026-09-25 09:55:37.918', NULL, NULL, '2026-09-24 09:55:37.962', '2026-09-24 09:55:37.962', 'follow-s8-test-1'),
(5, 1, 3, 9, NULL, 'VISIT', '2026-09-27 04:30:00.000', NULL, 'Customer not available. Try again tomorrow.', '2026-09-26 11:12:08.846', '2026-09-26 11:12:08.846', NULL),
(6, 4, 11, 17, NULL, 'CALL', '2026-10-14 00:00:00.000', '2026-10-16 21:16:33.536', 'Will do later', '2026-10-13 10:47:06.853', '2026-10-16 21:16:33.537', 'follow-1791888425660-0xmpqe');

-- --------------------------------------------------------

--
-- Table structure for table `lead`
--

CREATE TABLE `lead` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `contactPerson` varchar(191) DEFAULT NULL,
  `businessType` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `city` varchar(191) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `source` enum('MANUAL','MANAGER','IMPORT') NOT NULL DEFAULT 'MANUAL',
  `status` enum('NEW','ASSIGNED','CONTACTED','FOLLOW_UP','INTERESTED','NEGOTIATION','WON','LOST') NOT NULL,
  `temperature` enum('HOT','WARM','COLD') NOT NULL DEFAULT 'WARM',
  `potential` decimal(12,2) DEFAULT NULL,
  `assigneeId` int(11) DEFAULT NULL,
  `createdById` int(11) NOT NULL,
  `customerId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `clientRequestId` varchar(191) DEFAULT NULL,
  `approvalStatus` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'APPROVED',
  `approvedAt` datetime(3) DEFAULT NULL,
  `approvedById` int(11) DEFAULT NULL,
  `rejectionNote` varchar(500) DEFAULT NULL,
  `productInterest` varchar(200) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `lead`
--

INSERT INTO `lead` (`id`, `tenantId`, `name`, `phone`, `contactPerson`, `businessType`, `address`, `city`, `latitude`, `longitude`, `notes`, `source`, `status`, `temperature`, `potential`, `assigneeId`, `createdById`, `customerId`, `createdAt`, `updatedAt`, `clientRequestId`, `approvalStatus`, `approvedAt`, `approvedById`, `rejectionNote`, `productInterest`) VALUES
(1, 1, 'ABC Traders', '9876543210', 'Rajesh Kumar', NULL, 'Connaught Place', 'Delhi', 28.6328000, 77.2197000, NULL, 'MANAGER', 'WON', 'HOT', 120000.00, 3, 3, 2, '2026-09-24 08:36:32.706', '2026-09-24 12:13:51.504', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(2, 1, 'XYZ Enterprises', '9876501234', 'Amit Shah', NULL, 'Sector 18', 'Noida', 28.5708000, 77.3261000, NULL, 'MANAGER', 'WON', 'WARM', 75000.00, 3, 3, 1, '2026-09-24 08:36:32.730', '2026-09-24 12:13:51.542', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(3, 1, 'PQR Distributors', '9000011122', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MANUAL', 'ASSIGNED', 'HOT', 50000.00, 3, 3, NULL, '2026-09-24 08:39:34.744', '2026-09-24 08:39:34.744', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(4, 1, 'New Mart', '9000000001', NULL, NULL, 'Ring Road', 'Delhi', NULL, NULL, NULL, 'IMPORT', 'ASSIGNED', 'WARM', NULL, 7, 2, NULL, '2026-09-24 09:36:37.961', '2026-09-26 11:23:08.817', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(5, 1, 'Offline Kirana', '9000000099', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MANUAL', 'LOST', 'WARM', NULL, 3, 3, NULL, '2026-09-24 09:55:37.880', '2026-09-24 11:48:54.154', 'lead-s8-test-1', 'APPROVED', NULL, NULL, NULL, NULL),
(6, 1, 'Metro Mart', '9876512345', 'Neha Singh', NULL, 'Lajpat Nagar', 'Delhi', 28.5677000, 77.2433000, NULL, 'MANAGER', 'ASSIGNED', 'WARM', 54000.00, 7, 7, NULL, '2026-09-24 12:13:51.609', '2026-09-24 12:13:51.609', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(7, 1, 'City Wholesale', '9876598765', 'Vikram Mehta', NULL, 'Karol Bagh', 'Delhi', NULL, NULL, NULL, 'MANAGER', 'ASSIGNED', 'COLD', 30000.00, 7, 7, NULL, '2026-09-24 12:13:51.645', '2026-09-24 12:15:19.474', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(8, 1, 'Green Corner Store', '9876500001', NULL, NULL, 'Khan Market', 'Delhi', 28.5995141, 77.2259785, NULL, 'MANAGER', 'ASSIGNED', 'WARM', NULL, 3, 2, NULL, '2026-09-24 12:29:31.901', '2026-09-24 12:29:31.901', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(9, 1, 'test', '1234567890', 'Lokendra Kumar', NULL, NULL, 'noida', 28.4512569, 77.4551363, NULL, 'MANAGER', 'WON', 'WARM', NULL, 3, 2, NULL, '2026-09-24 12:39:12.374', '2026-09-24 12:41:28.662', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(10, 1, 'testing', '1234567891', NULL, NULL, NULL, 'noida', 28.4513085, 77.4551155, NULL, 'MANAGER', 'FOLLOW_UP', 'WARM', NULL, 7, 2, NULL, '2026-10-03 08:29:42.190', '2026-10-03 08:33:54.229', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(13, 1, 'Sepcune technology', '01234567890', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.6653992, 77.4069214, NULL, 'MANAGER', 'FOLLOW_UP', 'WARM', NULL, 3, 2, NULL, '2026-10-10 22:51:58.730', '2026-10-16 19:31:17.807', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(14, 4, 'Sepcune technology', '9084429530', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.4513085, 77.4551155, NULL, 'MANAGER', 'WON', 'WARM', NULL, 11, 8, NULL, '2026-10-13 08:46:01.958', '2026-10-13 10:26:51.414', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(15, 4, 'Sepcune technology1', '9190844295', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.4513085, 77.4551155, NULL, 'MANAGER', 'WON', 'WARM', NULL, 9, 8, NULL, '2026-10-13 10:15:21.126', '2026-10-24 07:13:28.652', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(16, 4, 'Sepcune technology22', '9112345678', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.4513085, 77.4551155, NULL, 'MANAGER', 'WON', 'WARM', NULL, 11, 8, NULL, '2026-10-13 10:23:19.561', '2026-10-24 07:11:08.583', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(17, 4, 'Sepcune technology', '9190844291', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.4542916, 77.4547354, NULL, 'MANAGER', 'WON', 'WARM', NULL, 11, 8, 3, '2026-10-13 10:29:03.887', '2026-10-16 21:04:35.033', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(18, 4, 'Sepcune technology', '9112345671', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.4544622, 77.4553472, NULL, 'MANAGER', 'ASSIGNED', 'WARM', NULL, 11, 8, NULL, '2026-10-13 10:30:55.374', '2026-10-13 10:30:55.374', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(19, 4, 'Sepcune technology32', '9084429532', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.4513085, 77.4551155, NULL, 'MANAGER', 'WON', 'WARM', NULL, 11, 8, NULL, '2026-10-13 10:40:42.347', '2026-10-13 10:42:09.298', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(20, 4, 'Test', '1111111111', 'Test', 'Retail ', 'Sector 155', 'Badauli Khader', 28.4512790, 77.4556290, 'Test purpose ', 'MANUAL', 'ASSIGNED', 'HOT', 50000.00, 11, 11, NULL, '2026-10-13 18:35:50.350', '2026-10-16 21:00:43.330', 'lead-1791916549364-h3j1ns', 'APPROVED', '2026-10-15 07:27:04.691', NULL, NULL, NULL),
(21, 4, 'Sepcune technology', '9112345674', 'LOKENDRA KUSHWAH', NULL, 'Thapenda 75', 'AGRA', 28.4577023, 77.4601142, NULL, 'MANAGER', 'WON', 'WARM', NULL, 9, 8, NULL, '2026-10-13 18:50:47.104', '2026-10-24 07:13:29.583', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(22, 6, 'ozone', '1234567890', 'raju', NULL, 'FF24+F68, Sector 155, Noida, Badauli Khader, Uttar Pradesh 201304', 'noida', 28.4513520, 77.4550950, NULL, 'MANAGER', 'WON', 'WARM', NULL, 15, 14, NULL, '2026-10-21 07:33:59.902', '2026-10-21 07:43:24.919', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(23, 4, 'Sepcune technology111', '9190844293', 'LOKENDRA KUSHWAH', NULL, 'https://maps.app.goo.gl/5UofSro7whHxU5S46', '', 28.4454031, 77.4653904, NULL, 'MANAGER', 'ASSIGNED', 'WARM', NULL, 11, 8, NULL, '2026-10-22 19:36:03.523', '2026-10-22 19:41:45.867', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(24, 8, 'loreal', '0987654324', 'lokendra', '', 'Vikas Marg, Laxmi Nagar Commercial Complex, Swasthya Vihar, New Delhi, Delhi, 110092', 'delhi', NULL, NULL, '', 'MANAGER', 'ASSIGNED', 'WARM', NULL, 19, 18, NULL, '2026-10-23 11:25:18.067', '2026-10-23 11:46:11.303', NULL, 'APPROVED', NULL, NULL, NULL, NULL),
(25, 8, 'lo', '2435463244', '4235', NULL, '3245', '324', 28.6955192, 77.2009277, NULL, 'MANAGER', 'NEW', 'WARM', NULL, NULL, 18, NULL, '2026-10-23 12:09:46.306', '2026-10-23 12:09:46.306', NULL, 'APPROVED', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `locationlog`
--

CREATE TABLE `locationlog` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `sessionId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `accuracy` decimal(8,2) DEFAULT NULL,
  `speed` decimal(8,2) DEFAULT NULL,
  `heading` decimal(8,2) DEFAULT NULL,
  `mocked` tinyint(1) NOT NULL DEFAULT 0,
  `battery` int(11) DEFAULT NULL,
  `capturedAt` datetime(3) NOT NULL,
  `receivedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `locationlog`
--

INSERT INTO `locationlog` (`id`, `tenantId`, `sessionId`, `userId`, `lat`, `lng`, `accuracy`, `speed`, `heading`, `mocked`, `battery`, `capturedAt`, `receivedAt`) VALUES
(1, 1, 1, 3, 28.6328000, 77.2197000, 12.00, NULL, NULL, 0, NULL, '2026-09-24 09:08:00.803', '2026-09-24 09:08:00.803'),
(2, 1, 1, 3, 28.6400000, 77.2300000, 90.00, NULL, NULL, 0, NULL, '2026-09-24 09:08:00.803', '2026-09-24 09:08:00.803'),
(3, 1, 6, 3, 28.4512569, 77.4551363, 279.00, NULL, NULL, 0, NULL, '2026-09-24 11:43:47.111', '2026-09-24 11:43:47.174'),
(4, 1, 7, 3, 28.4512569, 77.4551363, 279.00, NULL, NULL, 0, NULL, '2026-09-24 11:49:47.817', '2026-09-24 11:49:47.862'),
(5, 1, 8, 3, 28.4575660, 77.4603021, 183.00, NULL, NULL, 0, NULL, '2026-09-24 17:56:40.663', '2026-09-26 08:08:52.738'),
(6, 1, 8, 3, 28.4511609, 77.4550048, 257.00, NULL, NULL, 0, NULL, '2026-09-26 08:08:52.673', '2026-09-26 08:08:52.738'),
(7, 1, 9, 3, 28.4512569, 77.4551363, 279.00, NULL, NULL, 0, NULL, '2026-09-26 11:06:55.117', '2026-09-26 11:06:55.162'),
(8, 1, 10, 3, 28.4513085, 77.4551155, 187.00, NULL, NULL, 0, NULL, '2026-10-03 08:31:00.542', '2026-10-03 08:31:00.585'),
(9, 1, 11, 7, 28.4513085, 77.4551155, 187.00, NULL, NULL, 0, NULL, '2026-10-03 08:33:22.771', '2026-10-03 08:33:22.798'),
(10, 1, 12, 7, 28.4577088, 77.4601245, 118.00, NULL, NULL, 0, NULL, '2026-10-10 23:07:37.471', '2026-10-10 23:07:38.615'),
(11, 4, 15, 11, 28.4536884, 77.4541868, 116.10, 0.00, 0.00, 0, NULL, '2026-10-13 08:54:35.419', '2026-10-13 08:54:37.131'),
(12, 4, 15, 11, 28.4511087, 77.4557657, 20.00, 0.00, 0.00, 0, NULL, '2026-10-13 08:59:35.541', '2026-10-13 08:59:36.784'),
(13, 4, 16, 11, 28.4511085, 77.4557657, 100.00, 0.00, 0.00, 0, NULL, '2026-10-13 10:21:41.614', '2026-10-13 10:34:02.321'),
(14, 4, 16, 11, 28.4544760, 77.4551770, 61.25, 0.00, 0.00, 0, NULL, '2026-10-13 10:34:00.967', '2026-10-13 10:34:03.149'),
(15, 4, 16, 11, 28.4511083, 77.4557659, 20.00, 0.14, 57.25, 0, NULL, '2026-10-13 10:34:34.117', '2026-10-13 10:34:35.331'),
(16, 4, 17, 11, 28.4511084, 77.4557661, 20.00, 0.00, 0.00, 0, NULL, '2026-10-14 08:13:46.597', '2026-10-14 08:13:47.659'),
(17, 4, 18, 11, 28.4546559, 77.4550854, 82.50, 0.00, 0.00, 0, NULL, '2026-10-16 12:29:10.076', '2026-10-16 12:29:09.867'),
(18, 4, 18, 11, 28.4511046, 77.4557703, 20.00, 0.00, 0.00, 0, NULL, '2026-10-16 12:30:34.543', '2026-10-16 12:30:34.349'),
(19, 4, 18, 11, 28.4576209, 77.4600376, 100.00, 0.00, 0.00, 0, NULL, '2026-10-16 21:03:41.198', '2026-10-16 21:03:42.160'),
(20, 4, 19, 11, 28.4576209, 77.4600376, 100.00, 0.00, 0.00, 0, NULL, '2026-10-16 21:05:30.523', '2026-10-16 21:05:31.494'),
(21, 4, 19, 11, 28.4562734, 77.4596202, 100.00, 0.00, 0.00, 0, NULL, '2026-10-16 21:11:41.426', '2026-10-16 21:11:42.465'),
(22, 4, 19, 11, 28.4577109, 77.4601393, 111.00, NULL, NULL, 0, NULL, '2026-10-16 21:25:26.684', '2026-10-16 21:25:28.098'),
(23, 4, 20, 11, 28.4577436, 77.4600334, 30.00, 0.00, 0.00, 0, NULL, '2026-10-16 21:50:34.727', '2026-10-16 21:50:35.827'),
(24, 6, 21, 15, 28.4511657, 77.4557822, 66.64, 0.14, 191.04, 0, NULL, '2026-10-21 07:44:51.736', '2026-10-21 07:44:53.273'),
(25, 4, 22, 11, 28.4577043, 77.4601341, 106.00, NULL, NULL, 0, NULL, '2026-10-22 19:08:35.464', '2026-10-22 19:08:37.037'),
(26, 4, 22, 11, 28.5665000, 77.2072000, 20000.00, NULL, NULL, 0, NULL, '2026-10-22 19:36:12.066', '2026-10-22 19:36:13.678'),
(27, 4, 22, 11, 28.4576817, 77.4601373, 104.00, NULL, NULL, 0, NULL, '2026-10-22 19:36:13.173', '2026-10-22 19:36:14.671'),
(28, 4, 22, 11, 28.5665000, 77.2072000, 20000.00, NULL, NULL, 0, NULL, '2026-10-22 20:13:26.793', '2026-10-22 20:13:28.473'),
(29, 4, 22, 11, 28.4577043, 77.4601341, 106.00, NULL, NULL, 0, NULL, '2026-10-22 20:13:28.090', '2026-10-22 20:13:29.619'),
(30, 8, 24, 20, 28.4513520, 77.4550950, 212.00, NULL, NULL, 0, NULL, '2026-10-23 12:10:58.832', '2026-10-23 12:10:58.314'),
(31, 4, 26, 11, 28.4511284, 77.4557634, 21.60, 0.00, 0.00, 0, NULL, '2026-10-24 07:08:59.345', '2026-10-24 07:09:00.929');

-- --------------------------------------------------------

--
-- Table structure for table `locationsession`
--

CREATE TABLE `locationsession` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `status` enum('ACTIVE','ENDED') NOT NULL DEFAULT 'ACTIVE',
  `startedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `endedAt` datetime(3) DEFAULT NULL,
  `endedReason` enum('USER','ADMIN_OFF','AUTO_CLOSE') DEFAULT NULL,
  `lastLat` decimal(10,7) DEFAULT NULL,
  `lastLng` decimal(10,7) DEFAULT NULL,
  `lastAccuracy` decimal(8,2) DEFAULT NULL,
  `lastSeenAt` datetime(3) DEFAULT NULL,
  `pointCount` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `locationsession`
--

INSERT INTO `locationsession` (`id`, `tenantId`, `userId`, `status`, `startedAt`, `endedAt`, `endedReason`, `lastLat`, `lastLng`, `lastAccuracy`, `lastSeenAt`, `pointCount`, `createdAt`, `updatedAt`) VALUES
(1, 1, 3, 'ENDED', '2026-09-24 09:08:00.550', '2026-09-24 09:08:00.939', 'USER', 28.6400000, 77.2300000, 90.00, '2026-09-24 09:08:00.803', 2, '2026-09-24 09:08:00.550', '2026-09-24 09:08:00.940'),
(2, 1, 3, 'ENDED', '2026-09-24 09:08:43.753', '2026-09-24 09:09:18.145', 'USER', NULL, NULL, NULL, NULL, 0, '2026-09-24 09:08:43.753', '2026-09-24 09:09:18.147'),
(3, 1, 3, 'ENDED', '2026-09-24 09:09:19.336', '2026-09-24 09:09:20.201', 'USER', NULL, NULL, NULL, NULL, 0, '2026-09-24 09:09:19.336', '2026-09-24 09:09:20.202'),
(4, 1, 3, 'ENDED', '2026-09-24 09:09:21.648', '2026-09-24 09:47:40.080', 'USER', NULL, NULL, NULL, NULL, 0, '2026-09-24 09:09:21.648', '2026-09-24 09:47:40.081'),
(5, 1, 3, 'ENDED', '2026-09-24 09:47:43.664', '2026-09-24 10:33:05.285', 'USER', NULL, NULL, NULL, NULL, 0, '2026-09-24 09:47:43.664', '2026-09-24 10:33:05.287'),
(6, 1, 3, 'ENDED', '2026-09-24 10:33:12.046', '2026-09-24 11:49:29.641', 'USER', 28.4512569, 77.4551363, 279.00, '2026-09-24 11:49:25.615', 1, '2026-09-24 10:33:12.046', '2026-09-24 11:49:29.643'),
(7, 1, 3, 'ENDED', '2026-09-24 11:49:47.679', '2026-09-26 08:07:03.456', 'AUTO_CLOSE', 28.4512569, 77.4551363, 279.00, '2026-09-24 12:40:51.256', 1, '2026-09-24 11:49:47.679', '2026-09-26 08:07:03.457'),
(8, 1, 3, 'ENDED', '2026-09-26 08:08:49.196', '2026-09-26 11:05:50.215', 'USER', 28.4517060, 77.4555540, 107.00, '2026-09-26 08:34:20.300', 2, '2026-09-26 08:08:49.196', '2026-09-26 11:05:50.216'),
(9, 1, 3, 'ENDED', '2026-09-26 11:06:54.990', '2026-10-03 08:25:32.227', 'AUTO_CLOSE', 28.4512569, 77.4551363, 279.00, '2026-09-26 11:23:37.226', 1, '2026-09-26 11:06:54.990', '2026-10-03 08:25:32.229'),
(10, 1, 3, 'ENDED', '2026-10-03 08:30:57.067', '2026-10-10 23:06:59.386', 'AUTO_CLOSE', 28.4513085, 77.4551155, 187.00, '2026-10-03 08:32:32.579', 1, '2026-10-03 08:30:57.067', '2026-10-10 23:06:59.390'),
(11, 1, 7, 'ENDED', '2026-10-03 08:33:19.228', '2026-10-03 08:39:26.319', 'USER', 28.4513085, 77.4551155, 187.00, '2026-10-03 08:38:34.430', 1, '2026-10-03 08:33:19.228', '2026-10-03 08:39:26.320'),
(12, 1, 7, 'ACTIVE', '2026-10-10 23:07:33.378', NULL, NULL, 28.4577089, 77.4601127, 129.00, '2026-10-10 23:11:20.952', 1, '2026-10-10 23:07:33.378', '2026-10-10 23:11:20.954'),
(13, 4, 9, 'ENDED', '2026-10-12 20:01:55.324', '2026-10-13 08:22:56.053', 'AUTO_CLOSE', NULL, NULL, NULL, NULL, 0, '2026-10-12 20:01:55.324', '2026-10-13 08:22:56.053'),
(14, 4, 9, 'ACTIVE', '2026-10-13 08:23:15.741', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-10-13 08:23:15.741', '2026-10-13 08:23:15.741'),
(15, 4, 11, 'ENDED', '2026-10-13 08:44:56.194', '2026-10-13 10:21:10.065', 'USER', 28.4511146, 77.4557695, 29.94, '2026-10-13 10:21:07.770', 2, '2026-10-13 08:44:56.194', '2026-10-13 10:21:10.067'),
(16, 4, 11, 'ENDED', '2026-10-13 10:34:01.250', '2026-10-13 12:45:03.147', 'USER', 28.4511083, 77.4557662, 20.00, '2026-10-13 12:34:09.447', 3, '2026-10-13 10:34:01.250', '2026-10-13 12:45:03.148'),
(17, 4, 11, 'ENDED', '2026-10-14 08:13:42.213', '2026-10-14 08:28:41.897', 'USER', 28.4511085, 77.4557661, 100.00, '2026-10-14 08:27:42.523', 1, '2026-10-14 08:13:42.213', '2026-10-14 08:28:41.897'),
(18, 4, 11, 'ENDED', '2026-10-16 12:28:59.223', '2026-10-16 21:03:45.811', 'USER', 28.4576209, 77.4600376, 100.00, '2026-10-16 21:03:42.160', 3, '2026-10-16 12:28:59.223', '2026-10-16 21:03:45.811'),
(19, 4, 11, 'ENDED', '2026-10-16 21:05:31.173', '2026-10-16 21:28:22.550', 'USER', 28.4577109, 77.4601393, 111.00, '2026-10-16 21:27:29.003', 3, '2026-10-16 21:05:31.173', '2026-10-16 21:28:22.551'),
(20, 4, 11, 'ENDED', '2026-10-16 21:50:35.381', '2026-10-22 19:08:19.154', 'AUTO_CLOSE', 28.4577115, 77.4601340, 114.00, '2026-10-16 21:51:02.658', 1, '2026-10-16 21:50:35.381', '2026-10-22 19:08:19.155'),
(21, 6, 15, 'ENDED', '2026-10-21 07:32:36.420', '2026-10-24 07:06:49.448', 'AUTO_CLOSE', 28.4511657, 77.4557822, 66.64, '2026-10-21 07:44:53.273', 1, '2026-10-21 07:32:36.420', '2026-10-24 07:06:49.448'),
(22, 4, 11, 'ENDED', '2026-10-22 19:08:26.652', '2026-10-24 07:07:14.875', 'AUTO_CLOSE', 28.4577043, 77.4601341, 106.00, '2026-10-22 20:31:12.851', 5, '2026-10-22 19:08:26.652', '2026-10-24 07:07:14.876'),
(23, 8, 20, 'ENDED', '2026-10-23 11:43:31.918', '2026-10-23 11:46:35.321', 'USER', NULL, NULL, NULL, NULL, 0, '2026-10-23 11:43:31.918', '2026-10-23 11:46:35.322'),
(24, 8, 20, 'ACTIVE', '2026-10-23 11:46:38.351', NULL, NULL, 28.4513520, 77.4550950, 212.00, '2026-10-23 12:11:26.144', 1, '2026-10-23 11:46:38.351', '2026-10-23 12:11:26.145'),
(25, 4, 11, 'ENDED', '2026-10-24 07:07:24.775', '2026-10-24 07:08:27.106', 'USER', NULL, NULL, NULL, NULL, 0, '2026-10-24 07:07:24.775', '2026-10-24 07:08:27.107'),
(26, 4, 11, 'ACTIVE', '2026-10-24 07:08:32.185', NULL, NULL, 28.4511295, 77.4557655, 100.00, '2026-10-24 07:21:25.379', 1, '2026-10-24 07:08:32.185', '2026-10-24 07:21:25.381');

-- --------------------------------------------------------

--
-- Table structure for table `monthlytarget`
--

CREATE TABLE `monthlytarget` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `month` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `monthlytarget`
--

INSERT INTO `monthlytarget` (`id`, `tenantId`, `userId`, `year`, `month`, `amount`, `createdAt`, `updatedAt`) VALUES
(1, 1, 3, 2026, 9, 50000.00, '2026-09-24 09:43:36.447', '2026-09-24 12:42:57.654'),
(2, 4, 11, 2026, 10, 0.00, '2026-10-13 12:04:54.492', '2026-10-13 12:04:54.492');

-- --------------------------------------------------------

--
-- Table structure for table `refreshtoken`
--

CREATE TABLE `refreshtoken` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `deviceId` int(11) DEFAULT NULL,
  `tokenHash` varchar(191) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `revokedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `refreshtoken`
--

INSERT INTO `refreshtoken` (`id`, `userId`, `deviceId`, `tokenHash`, `expiresAt`, `revokedAt`, `createdAt`) VALUES
(1, 3, 1, '86959a16bea6b7d130fd35ad72e6a6d015301c3731d44122227253b80578aa39', '2026-10-24 08:20:29.018', NULL, '2026-09-24 08:20:29.019'),
(2, 1, NULL, 'a10b8797196c863da8b5655f1c53b9ca176e5ff79ce390d5137efc1047afecea', '2026-10-24 08:20:29.305', '2026-10-15 13:02:59.497', '2026-09-24 08:20:29.306'),
(3, 3, 2, '1020efe35d5ef033d1a7f83bfca64e95cf6120723d79d1c958afdef054cb0edf', '2026-10-24 08:29:03.421', '2026-09-24 08:30:45.568', '2026-09-24 08:29:03.423'),
(4, 3, 2, '0560c7e2d8404b2ffe851761d1d250899969e95cc1a923bc0bc59faa06e79703', '2026-10-24 08:29:33.115', '2026-09-24 08:32:22.359', '2026-09-24 08:29:33.117'),
(5, 3, 2, '2c9286ea5dac4752e2684b29b7e4153e2117c9e3a95d6622c6bfb4a3530e6f48', '2026-10-24 08:32:38.893', '2026-09-24 08:32:56.930', '2026-09-24 08:32:38.895'),
(6, 1, 3, '4320020f057773b1b74dad01ffe1ce1b137dcdcdc4da63addba11818e0e43f68', '2026-10-24 08:33:09.970', '2026-09-24 08:33:26.734', '2026-09-24 08:33:09.971'),
(7, 2, 4, '9240dd5ec8eeab50665290986d62630f9705d5bcdc3d88ec06e81273b611c3ce', '2026-10-24 08:33:29.856', '2026-09-24 08:33:34.817', '2026-09-24 08:33:29.857'),
(8, 3, NULL, '75c5215faca8c0f87af683f78442850cbfa15da76501a78abdf235100a7d3090', '2026-10-24 08:39:07.523', NULL, '2026-09-24 08:39:07.527'),
(9, 3, NULL, '2451e46e3c5a0b5cbc02bdb1c8d75232068d51cb3bc3d76bdb766c2a426d8a0a', '2026-10-24 08:39:19.190', NULL, '2026-09-24 08:39:19.192'),
(10, 3, NULL, '71141c3fca05f41f8b4b8f6d15bfd466f778128d4713e1fd698c05ff57b1d170', '2026-10-24 08:39:34.705', NULL, '2026-09-24 08:39:34.707'),
(11, 3, 2, 'dba3076453e90901d90b6dca5b0f52955ea55b4027ca3fc15db499a67019596f', '2026-10-24 08:40:10.471', '2026-09-24 08:41:03.534', '2026-09-24 08:40:10.473'),
(12, 3, 2, '4217b906aa5e2a03ccd9e4f2ae2a4ecfe94dc51225989138bb998372be86f9fc', '2026-10-24 08:41:03.553', '2026-09-24 08:42:05.789', '2026-09-24 08:41:03.555'),
(13, 2, 4, 'fa8e93d1c92e6a37a46bfb50c7996c09af64ad27642251667eb762e567f091c9', '2026-10-24 08:42:16.611', '2026-09-24 08:44:18.995', '2026-09-24 08:42:16.613'),
(14, 2, 4, 'da192b5edda7756818272b998f53d16789e2c1054ad01d8d2de5f72b33143ede', '2026-10-24 08:44:19.021', '2026-09-24 08:44:24.578', '2026-09-24 08:44:19.023'),
(15, 2, 4, '9e08a8f2870ed0b20fbf005831be39479e3ed088123b3d71d29ca78573ae5a32', '2026-10-24 08:44:24.593', '2026-09-24 08:46:32.835', '2026-09-24 08:44:24.594'),
(16, 2, 4, '84c46e7460410e2d52817bdf2bf128668d1077ef0dc226f0477cbeb149a384f5', '2026-10-24 08:46:32.877', '2026-09-24 08:47:17.866', '2026-09-24 08:46:32.878'),
(17, 1, 3, '4d7b5fee5707d72a62be1dd6e967eb4bacdb5e869950acc9da7a59ed6342e36c', '2026-10-24 08:47:26.639', '2026-09-24 08:51:00.256', '2026-09-24 08:47:26.640'),
(18, 1, 3, '66ddb74b55a7763de64505cdc83e649384ff4f3feceb3bc617880f5a6a243293', '2026-10-24 08:51:00.384', '2026-09-24 08:52:03.279', '2026-09-24 08:51:00.386'),
(19, 1, NULL, '7cc8d1155e62b54ea7aed872fea4a6f07b9c2936f27dc9d1bbc2399941d94659', '2026-10-24 08:51:23.860', '2026-10-15 13:02:59.497', '2026-09-24 08:51:23.862'),
(20, 2, NULL, 'af92d566d6519682accd652d778d1dcbc5f5149e04ffecd19a361a85827dbd66', '2026-10-24 08:51:24.096', NULL, '2026-09-24 08:51:24.098'),
(21, 1, 3, '413fdd7e4d59bc67921f80215a7307636e8ffe3c15a310d11ada122c464db920', '2026-10-24 08:52:03.290', '2026-09-24 08:52:15.994', '2026-09-24 08:52:03.292'),
(22, 1, 3, 'e8836ac8907288eaca0b32467670d53acfb2cae4f3f1d0ef4480ab9b00aa17dc', '2026-10-24 08:52:16.006', '2026-09-24 08:52:24.532', '2026-09-24 08:52:16.008'),
(23, 2, 4, '24c82efb69d13032a5b87c12347fa4687e1ceccb1007ec5649aa847cf7595922', '2026-10-24 08:52:59.378', NULL, '2026-09-24 08:52:59.380'),
(24, 3, NULL, '9addaaae1f6340118d9f028293538f0df071e705ba89cb31b865795b9bae7586', '2026-10-24 08:59:37.264', NULL, '2026-09-24 08:59:37.266'),
(25, 1, NULL, '9b50efe91ffce3ba1e4f6b365f58fdee29292796b544653cb64b8a330167f319', '2026-10-24 08:59:38.349', '2026-10-15 13:02:59.497', '2026-09-24 08:59:38.351'),
(26, 3, 2, '6a95ba81a0eb0471abc55fcfccf1714d3ca19ec82c13a552d4b846aea8b13c97', '2026-10-24 09:01:11.422', '2026-09-24 09:02:27.315', '2026-09-24 09:01:11.423'),
(27, 3, 2, '1c427118f66d94e1e87cc8395a6bcbf428660ab12d20834d13e9d715d2d5e780', '2026-10-24 09:02:27.366', '2026-09-24 09:06:11.372', '2026-09-24 09:02:27.368'),
(28, 3, NULL, 'e1f45343d78fd18a18ee8f21eddfa4153856cae21bcb04cc46402f1a22a01dcb', '2026-10-24 09:02:29.085', NULL, '2026-09-24 09:02:29.086'),
(29, 3, 2, 'cc584e056963d747320ac09c1e525c28bee53d407eb15bd65f243d09ec84b34f', '2026-10-24 09:06:11.423', '2026-09-24 09:06:25.694', '2026-09-24 09:06:11.425'),
(30, 3, 2, '74ab743b8c2cfb7fc36bff3b14c6f6b6d66ca0c16cc137208cf446289cc5358f', '2026-10-24 09:06:25.712', '2026-09-24 09:06:26.373', '2026-09-24 09:06:25.714'),
(31, 3, 2, 'dfd5079cbff19b30bd208f4be29625aad8ab6f31b218fc82b8d795f03d5f7412', '2026-10-24 09:06:26.406', '2026-09-24 09:08:31.437', '2026-09-24 09:06:26.408'),
(32, 3, NULL, '7c6f4578ba33aad1aa9ed1bb09fe06f92c25784711d375134b04fa68cde70103', '2026-10-24 09:07:59.916', NULL, '2026-09-24 09:07:59.918'),
(33, 1, NULL, 'b8f472edcbd7bba54b708003c86377a9e41f993996af20c2e0b7f6e7e2ad458a', '2026-10-24 09:08:00.193', '2026-10-15 13:02:59.497', '2026-09-24 09:08:00.195'),
(34, 2, NULL, 'edaed0c29c16828477c0fa46f66b1e578e5b97d931bc267aae37f101901d4953', '2026-10-24 09:08:00.459', NULL, '2026-09-24 09:08:00.461'),
(35, 3, 2, 'f49274914799f23d3d8a1a8d9090621b289d959d690a9e91419ed9bcda4a501f', '2026-10-24 09:08:31.450', NULL, '2026-09-24 09:08:31.452'),
(36, 2, 5, 'b8c5d0a4b416e423b52c083d27ca45b36efb84d8fca527067ee5953a1a26ce62', '2026-10-24 09:18:39.053', '2026-09-24 09:19:05.391', '2026-09-24 09:18:39.055'),
(37, 3, 6, '787629983d3bf6b855cde264ef4bb14bc72f59e0b4675fb29838c518758f2d78', '2026-10-24 09:19:15.145', '2026-09-24 09:19:43.402', '2026-09-24 09:19:15.147'),
(38, 2, 5, '1f71010773708f474747bf3aee764ddc71cd5d173cd8c49007d20d6c08644a09', '2026-10-24 09:21:58.285', '2026-09-24 09:22:02.064', '2026-09-24 09:21:58.287'),
(39, 2, 5, 'b26defb867b4cf94341a29e946b5bd825303589c62d31e6849d7433d715a1f5e', '2026-10-24 09:22:02.097', NULL, '2026-09-24 09:22:02.099'),
(40, 2, 5, '97187789b0c4d0f2218eff6530de96a9fa47ca28bf3fa6b5f08a6667a682e761', '2026-10-24 09:22:02.132', '2026-09-24 09:22:45.229', '2026-09-24 09:22:02.133'),
(41, 3, 6, '4fd0f53cc8dccafb24074099ad76ec282b85d3012fbc20190bc7360031bb1ade', '2026-10-24 09:22:57.469', '2026-09-24 09:25:17.154', '2026-09-24 09:22:57.471'),
(42, 3, 6, '336c0198b275b672e99f037bc871c5b53c9ed666cac4fcd862bbb5be1d61a4ab', '2026-10-24 09:25:35.377', NULL, '2026-09-24 09:25:35.379'),
(43, 3, 2, 'be78ddcfc55593eac13e82956769cf310b4cb26077c18da0615fff8be783a189', '2026-10-24 09:25:47.763', NULL, '2026-09-24 09:25:47.764'),
(44, 3, 2, 'a8efccfdb711e5b3627a510ccb76bf4ca9251f28cd84a560add16299b86c1e79', '2026-10-24 09:26:35.739', NULL, '2026-09-24 09:26:35.740'),
(45, 2, 7, '31e784cd42a6a6675058adba33d64ac7aeb6c92436976329e4529c0571ec8b90', '2026-10-24 09:36:09.204', NULL, '2026-09-24 09:36:09.206'),
(46, 3, 8, '4f5f73c7bfad2b59001c5c429ac0c5bc6635df899214ee8ff72a9a5df969bd71', '2026-10-24 09:36:09.624', NULL, '2026-09-24 09:36:09.626'),
(47, 2, 7, '3f1a7ea84667c16ea96562c0d823ff875939f31e4ab2cb2d317bb0284cd21dec', '2026-10-24 09:36:21.281', NULL, '2026-09-24 09:36:21.283'),
(48, 3, 8, '1db3bc7a83db514492a209e44d56da3b9776e14e29ca47baf7036d1817d927fd', '2026-10-24 09:36:21.606', NULL, '2026-09-24 09:36:21.608'),
(49, 2, 7, '68741a6c64b8838fa2e3cfb2a408dae5c4cd936e90fafc83e416aff17339ab43', '2026-10-24 09:36:36.321', NULL, '2026-09-24 09:36:36.323'),
(50, 3, 8, '29fd1bb0c1377d0c41be41347dd6f459ec81fe8d293e997c0420ad70b91dece8', '2026-10-24 09:36:36.534', NULL, '2026-09-24 09:36:36.536'),
(51, 2, 5, 'bb367ee120ba7f6a4f59d27f870bd837f4b23b867a68c006d127e90ab4873641', '2026-10-24 09:37:46.796', '2026-09-24 09:44:20.123', '2026-09-24 09:37:46.797'),
(52, 2, 9, '14acc5c162ada5fbe3d819e43401fa008287f04c6fab9ea751e66ab5225ba240', '2026-10-24 09:43:58.834', NULL, '2026-09-24 09:43:58.836'),
(53, 3, 10, '4cc5ebebda554a230d2fea66b24e1b382d335442c5e900018ad266c738213167', '2026-10-24 09:43:59.194', NULL, '2026-09-24 09:43:59.195'),
(54, 2, 5, '443ff8fb3c5cca235c1aabb3ce7997908257d1952d3884af6659dc0cba7773af', '2026-10-24 09:44:20.153', NULL, '2026-09-24 09:44:20.154'),
(55, 2, 5, 'd0fa22b9347248362b4ede225285a0a9069b9e9338061b4779892abd3da80f24', '2026-10-24 09:44:20.164', '2026-09-24 10:41:41.862', '2026-09-24 09:44:20.165'),
(56, 3, 2, '4ccd80a56ce6f02779be032a8ceb7f5b63a6d5ec3708c64349c944b0c61ee324', '2026-10-24 09:47:34.414', '2026-09-24 09:49:09.514', '2026-09-24 09:47:34.419'),
(57, 3, 2, '7f67f6f195c49ad80bec2a715d40223e2004275869e51495811eeb189b56490a', '2026-10-24 09:49:09.551', '2026-09-24 09:49:12.154', '2026-09-24 09:49:09.552'),
(58, 3, 2, '49eb3ebcc07dbe68b3c0d2c93cb340d39fa3ab0e6d6218ca5b53a9ec5283319b', '2026-10-24 09:49:12.289', '2026-09-24 09:49:15.321', '2026-09-24 09:49:12.291'),
(59, 3, 2, '21a1a2725f20711336031458cc23d002252aed68776836e0f5ff9b8fad54a28f', '2026-10-24 09:49:15.709', '2026-09-24 09:49:24.345', '2026-09-24 09:49:15.713'),
(60, 3, 2, 'fd903dd7fc50bd1019753d42b13530b055d691676a8b921774ff33f63e1ed0f0', '2026-10-24 09:49:24.428', '2026-09-24 09:49:26.565', '2026-09-24 09:49:24.430'),
(61, 3, 2, '61ef4f9d4f211a1228daadab32e9a6b1ce3a6eddc3a6d2290d3bf97ef980e2e6', '2026-10-24 09:49:29.841', '2026-09-24 09:49:38.466', '2026-09-24 09:49:29.842'),
(62, 3, 2, '090ebc01ce73cef69aba0e1dabd04a9e474fb6aa594598c90325d216fd06e28b', '2026-10-24 09:49:39.796', NULL, '2026-09-24 09:49:39.797'),
(63, 3, 2, '6af1a04cc1733c682d15bfa349db337a17ff4e2f01fb7465829bb5f4d03267e3', '2026-10-24 09:49:39.871', '2026-09-24 09:49:40.791', '2026-09-24 09:49:39.874'),
(64, 3, 2, '26a76554000e983f7fdf68260fe3355827c837eae997c6b5da86e126c0e73814', '2026-10-24 09:49:41.119', '2026-09-24 09:50:01.378', '2026-09-24 09:49:41.120'),
(65, 3, 2, '9dbaa7f36169c889d0e9089312f9e853cb6697b290eb11768fa77e34b381058d', '2026-10-24 09:50:01.427', '2026-09-24 10:23:25.445', '2026-09-24 09:50:01.428'),
(66, 3, 11, 'ac3448d832a000717811a910cb99929bb51eb3bae7cd0d1a794c6135670d7cd1', '2026-10-24 09:55:37.706', NULL, '2026-09-24 09:55:37.707'),
(67, 3, 2, 'b0f3900888de0a1829f4dd1a5b62be854aaa099001fc9e383d138654686d3e59', '2026-10-24 10:23:25.571', '2026-09-24 10:23:43.340', '2026-09-24 10:23:25.574'),
(68, 3, 2, '77b9fbd592619d5aa3ae55cba1b6e4a20c3fa55e992371faa51385ba3fe1dba7', '2026-10-24 10:23:43.496', '2026-09-24 10:39:48.309', '2026-09-24 10:23:43.499'),
(69, 2, 5, '5ef8d7903019fdc146f4c1a834621743c909b8f798f8cb0da5a5592e8abe6c86', '2026-10-24 10:28:19.778', '2026-09-26 07:56:33.446', '2026-09-24 10:28:19.779'),
(70, 3, 2, '7453164d3e3f8b1d80c715a51cc2eb717d385cf26ea8664d0b10bcd852f1e998', '2026-10-24 10:30:42.366', '2026-09-24 10:39:48.276', '2026-09-24 10:30:42.368'),
(71, 3, 2, 'de545ddf375bfa77104dcb1e015e3420d61a550c0a1a81a53aa57878a563d680', '2026-10-24 10:39:48.426', '2026-09-24 10:42:09.010', '2026-09-24 10:39:48.428'),
(72, 3, 2, '31c66952155eb5c3f2fbe21cc4b632ca81954b45a343bbc2aa79ae1a804bd2bf', '2026-10-24 10:39:48.421', '2026-09-24 11:10:53.972', '2026-09-24 10:39:48.423'),
(73, 2, NULL, 'c701950f438591076e2c34c1f97df520560b14ab038005302920b481315a06bf', '2026-10-24 10:41:06.174', NULL, '2026-09-24 10:41:06.175'),
(74, 3, NULL, '9a9bb186f9095f86e1e90d6d68eaf792bf9c74be43a9a8edc05547ceaafeb7cc', '2026-10-24 10:41:07.132', NULL, '2026-09-24 10:41:07.133'),
(75, 2, NULL, '8347161a06da90be8bb906a2a1ab8c574630dcaf96fb05a47045ed0b8c73dec0', '2026-10-24 10:41:28.937', NULL, '2026-09-24 10:41:28.938'),
(76, 2, 5, '7f4be426a7a31a032f9d07ae4c2c6d27896b13fb82930a36e9c7362cc0f07205', '2026-10-24 10:41:41.902', NULL, '2026-09-24 10:41:41.903'),
(77, 2, 5, 'd8e00813f84c4175dc3419736d49bc0bea9ed04f03d91ab44fdec3ff528d606e', '2026-10-24 10:41:41.929', '2026-09-24 10:48:57.975', '2026-09-24 10:41:41.930'),
(78, 3, 2, '8e585dc57102c627c2b9f55bc4e28ddf3be0477599ddd716088b5463f9e74eff', '2026-10-24 10:42:09.035', '2026-09-24 10:42:16.162', '2026-09-24 10:42:09.037'),
(79, 3, 2, 'f9a857f89ce4750f81cf440f63836925dead9c59a654f857e050ae518a758805', '2026-10-24 10:42:16.199', '2026-09-24 11:10:52.219', '2026-09-24 10:42:16.202'),
(80, 2, 5, '2f1d8c5779fb78aeff8763e9141484984a5bc42c769a04deb992d3d6a1425739', '2026-10-24 10:48:57.991', NULL, '2026-09-24 10:48:57.993'),
(81, 2, 5, '3991e1b8becf44d87e69fe817d4b35467b0e5bd3cae382aabf362bb42200d6ef', '2026-10-24 10:50:13.418', '2026-09-24 10:50:21.422', '2026-09-24 10:50:13.420'),
(82, 2, 5, '14779e7185793258b79bf68969eff3d848f66c57be07c59733eb7e26576fd6a9', '2026-10-24 10:50:21.447', NULL, '2026-09-24 10:50:21.448'),
(83, 1, 12, '1e99fdf828e8b4193cd16a10bb2e9b3f2c2eb8598f394374af2d1d95e735c1cd', '2026-10-24 10:56:05.844', '2026-09-24 10:59:06.656', '2026-09-24 10:56:05.847'),
(84, 1, 13, '7b1a392bfa1b21b1861063a252084ea022e3c2b1724d4ecbac44274919d74d58', '2026-10-24 10:58:48.605', '2026-10-15 13:02:59.497', '2026-09-24 10:58:48.606'),
(87, 1, 12, '9ee3c3c71ec861e7a62d2fbc9e9489dbedcbde7ef5d74b95a53861d4be428302', '2026-10-24 10:59:06.676', '2026-10-15 13:02:59.497', '2026-09-24 10:59:06.677'),
(88, 1, 12, 'b9009e65ea74837fd4c9106ba5478340bca1aaec6c12a71d38b2e6be0c240536', '2026-10-24 10:59:06.691', '2026-09-24 10:59:22.244', '2026-09-24 10:59:06.692'),
(89, 1, 12, 'ac97212c85caf247119f7c1012fbbf492ced1271f3f725043543637e8e01c588', '2026-10-24 10:59:23.288', '2026-10-15 13:02:59.497', '2026-09-24 10:59:23.289'),
(90, 1, 12, '4f2b460df493205c89e6881a7b74d11a9f36cb4e8dfda279737a99a97d021677', '2026-10-24 10:59:25.413', '2026-09-24 10:59:36.539', '2026-09-24 10:59:25.415'),
(91, 1, 12, '2de7f4fb031f905ed3c6ac38cd779b7a58f55528f6db7ab23bc828f309e98e82', '2026-10-24 11:01:01.004', '2026-09-24 11:03:23.421', '2026-09-24 11:01:01.005'),
(92, 1, 12, 'b5d1bbc97c64035f2fd5fc30bee6f5283b327bb97e6903d6ddebe6b0cc6c9e34', '2026-10-24 11:03:23.522', '2026-10-15 13:02:59.497', '2026-09-24 11:03:23.523'),
(93, 1, 12, '40e29586a66893f5614787a78c95d1d69d9f5730aa6d808e3a6f46646d2817ce', '2026-10-24 11:03:23.567', '2026-09-24 11:04:47.372', '2026-09-24 11:03:23.568'),
(94, 1, 13, 'd7f2e1a93653f8d142203bc51062253543d028e5d7407a9127f72494aebe453c', '2026-10-24 11:04:30.863', '2026-10-15 13:02:59.497', '2026-09-24 11:04:30.864'),
(96, 1, 12, '117fb8781bfcb218b0bca337b45615d9c7b74189d3c60499dabb29b21b2e55ef', '2026-10-24 11:04:47.410', '2026-10-15 13:02:59.497', '2026-09-24 11:04:47.411'),
(97, 1, 12, 'a483a89282d0e13412e957834f4df13071a55d2f72ab5f2d192eabd0d1c0f1f8', '2026-10-24 11:04:47.467', '2026-09-24 11:08:28.062', '2026-09-24 11:04:47.468'),
(98, 2, 16, 'd12239d90e6628bd8936938dc9269bfcbe1ab1aaa2cc8b7dcdd3b37c440b67ad', '2026-10-24 11:08:09.927', NULL, '2026-09-24 11:08:09.929'),
(99, 2, 16, '9528e15e3e98373e8440a59bfe9cf5487e23f09b767019835e85162fa523cec4', '2026-10-24 11:08:11.433', NULL, '2026-09-24 11:08:11.435'),
(100, 3, 17, '8c1cc1129777662c9056dd558804f8baf30236c51dc9dfaaea082e765d38ba46', '2026-10-24 11:08:12.197', NULL, '2026-09-24 11:08:12.199'),
(101, 1, 12, '41e3ede4bbc7d53fb7acf959d3a2386a0b0ab2cbb689817be3b035e8dd60844b', '2026-10-24 11:08:28.058', '2026-10-15 13:02:59.497', '2026-09-24 11:08:28.060'),
(102, 1, 12, '82bfebe872b35e52ab409fb350399e3fc2a1b5b0ff3631f63c0b1b37e9c7f6a1', '2026-10-24 11:08:28.134', '2026-09-24 12:13:52.284', '2026-09-24 11:08:28.136'),
(103, 3, 2, '2e314cc9abd7b4b5d72d7b214ab980e6375793dbc7736d06f2b8997c64513f1d', '2026-10-24 11:10:52.304', '2026-09-24 11:10:54.479', '2026-09-24 11:10:52.308'),
(104, 3, 2, '966c3a4c4b198071db701027e9144edd4ef19001b5ed621e04e1f47caf0bbc3e', '2026-10-24 11:10:54.031', '2026-09-24 11:10:55.905', '2026-09-24 11:10:54.033'),
(105, 3, 2, '40a875e51dc43c62fa159f9638c3c9e2913600c9f697640eeb4808eb64fe5256', '2026-10-24 11:10:54.730', '2026-09-24 11:11:01.798', '2026-09-24 11:10:54.732'),
(106, 3, 2, '8c15d105613497754ffb31b6a5526290beca96a53e2e5ee058c85e482f468413', '2026-10-24 11:10:55.993', '2026-09-24 11:11:03.653', '2026-09-24 11:10:55.994'),
(107, 3, 2, 'ba37a965c0596dbb4dc5073bb833da8f3c94604c93c6c60b11d180a52b14cbca', '2026-10-24 11:11:01.861', '2026-09-24 11:11:04.673', '2026-09-24 11:11:01.862'),
(108, 3, 2, '6bdac0841231522fdd31e35c6b40ac60122faa3917531f138d8c4169bd7dd10a', '2026-10-24 11:11:03.721', '2026-09-24 11:11:04.833', '2026-09-24 11:11:03.722'),
(109, 3, 2, '73970b6016e7264b4cfcc666f75dc352bb322c694197d7df52e947407a04b58b', '2026-10-24 11:11:04.712', '2026-09-24 11:26:04.909', '2026-09-24 11:11:04.713'),
(110, 3, 2, 'e341ebd73e509ac78e68845885c0d9c395953ffe1da41a069107d0dc3cafc91b', '2026-10-24 11:11:04.916', '2026-09-24 11:26:30.731', '2026-09-24 11:11:04.918'),
(111, 3, 2, '284b775a9838da902833432927b97f32c03186b87d0dfe05e91d657eabc18281', '2026-10-24 11:26:04.947', '2026-09-24 11:26:34.053', '2026-09-24 11:26:04.949'),
(112, 3, 2, '648055debf6f4716f8dbc2bc7d0480744f6fd7685d17d3d9630ebcdabc80b92e', '2026-10-24 11:26:30.761', '2026-09-24 11:35:19.245', '2026-09-24 11:26:30.765'),
(113, 3, 2, '459e7b4942606b1e59aeacc9fc3ac6b8261429218d09be0719721140b79693ce', '2026-10-24 11:26:34.079', '2026-09-24 11:27:21.773', '2026-09-24 11:26:34.081'),
(114, 3, 2, '141be50938133795f5013e3ff1ab9f86d0670e5872e8e754e586305a5325c2d3', '2026-10-24 11:27:21.804', '2026-09-24 11:28:33.825', '2026-09-24 11:27:21.805'),
(115, 3, 2, '52f044b0b376ccef30e981a6cc743d8ba5f600d6b53dac56ffa61edcdc9d3d4f', '2026-10-24 11:28:33.841', '2026-09-24 11:28:48.718', '2026-09-24 11:28:33.842'),
(116, 3, 2, 'a4a8e626065715a469572f51d9426e15de0c49857d5387f353b45fccde5fa0f8', '2026-10-24 11:28:48.731', '2026-09-24 11:32:40.843', '2026-09-24 11:28:48.733'),
(117, 3, 2, 'dfacc5d5392c7251a5b00cbf4df922fff5bf167d5cba4b717dfe0bfa416401c2', '2026-10-24 11:32:40.869', '2026-09-24 11:35:37.611', '2026-09-24 11:32:40.870'),
(118, 3, 2, '5e455a8247c1290e4820d59e51ad5d19c04b7b7524e3aba20bbbc417768c4d92', '2026-10-24 11:35:19.318', '2026-09-24 11:36:40.756', '2026-09-24 11:35:19.319'),
(119, 3, 2, '88f80a81ecf7ec16cfd158cdde978e64206219f9d011b378d3ccd861aab787dd', '2026-10-24 11:35:37.675', '2026-09-24 11:36:40.511', '2026-09-24 11:35:37.676'),
(120, 3, 2, 'dbc9185377517a91135f783d961fae62f80577026470472d34ccb9400c21d2b7', '2026-10-24 11:36:40.640', '2026-09-24 11:37:15.362', '2026-09-24 11:36:40.641'),
(121, 3, 2, '7018ad58e32352b449b3186af25db105a75eca75a6a0df19259845f6f7b02a0b', '2026-10-24 11:36:41.177', '2026-09-24 11:37:17.340', '2026-09-24 11:36:41.178'),
(122, 3, 2, '2d455b4b22d9958674fd1df0782f2d97ab7527fbb049d95f5d310cda291c88a8', '2026-10-24 11:37:15.437', '2026-09-24 11:39:04.237', '2026-09-24 11:37:15.438'),
(123, 3, 2, 'adaaa24aedd76555f56d6a08af4552201702a38760c9f2dc4aac6d82d74d7222', '2026-10-24 11:37:18.080', '2026-09-24 11:49:25.203', '2026-09-24 11:37:18.080'),
(124, 3, 2, '3ce4e4d5f9173077067f9d7bbea09e4029c7a6a59358f4268180c696a5b474e5', '2026-10-24 11:39:04.266', '2026-09-24 11:39:59.097', '2026-09-24 11:39:04.268'),
(125, 3, 2, '43fda499c18aabfcf4c9f10e710bac52f97d4db4a06fab85b42aefcb0808dcc6', '2026-10-24 11:39:59.418', '2026-09-24 11:40:30.109', '2026-09-24 11:39:59.419'),
(126, 3, 2, 'd5746ad2c16008e7c226a77d5371469c09319e25728b7ef5ccb70f24f2cc2d60', '2026-10-24 11:40:30.137', '2026-09-24 11:55:30.240', '2026-09-24 11:40:30.140'),
(127, 3, 2, 'fa5f1d4a1c4ea245e716b804877106da3e2618e07ef4a3dc4a8148438a800fb2', '2026-10-24 11:49:25.218', '2026-09-24 11:54:32.246', '2026-09-24 11:49:25.220'),
(128, 3, 2, '9dc5d427a4df4b7714f696ed2914052926991b34e1ecdd95181d69d368ba8a22', '2026-10-24 11:54:32.325', '2026-09-24 11:54:33.776', '2026-09-24 11:54:32.327'),
(129, 3, 2, 'd8966a2c5d064efd78f2324df56432dd7c7ddfef1eba5b533082a080bdddabf9', '2026-10-24 11:54:33.858', '2026-09-24 11:55:35.141', '2026-09-24 11:54:33.859'),
(130, 3, 2, '37904b2e663ef3952e8b9d536995a885e12cb349595365f29248db46c437f976', '2026-10-24 11:55:30.276', '2026-09-24 12:10:31.058', '2026-09-24 11:55:30.278'),
(131, 3, 2, '66250bc6ff71db1c4f3670371d35657f865722bdfa808a7c63cf23910eeecd05', '2026-10-24 11:55:38.798', '2026-09-24 12:10:56.832', '2026-09-24 11:55:38.800'),
(132, 2, 5, 'e8b8e95a1a1e8048040f3fdc7abeb8e7c91ffb32bdcfe610ef4354a55baeb5d1', '2026-10-24 12:04:07.208', '2026-09-24 12:37:23.244', '2026-09-24 12:04:07.208'),
(133, 3, 2, 'ccac8f5bc24a14be631f3ab0b3ae41d99f0cfe0a005e7293d42ed05a501b9071', '2026-10-24 12:10:33.347', NULL, '2026-09-24 12:10:33.348'),
(134, 3, 2, 'c676abd6620798eff75a271700d45e1ff52df1b48581b1246f203fd1f3e428b5', '2026-10-24 12:10:56.850', '2026-09-24 12:26:31.188', '2026-09-24 12:10:56.853'),
(135, 1, 12, 'b44457e1f34610e60d7dd54865dff5b467a97d3eec8929adc56a4392f692bac5', '2026-10-24 12:13:52.268', '2026-10-15 13:02:59.497', '2026-09-24 12:13:52.270'),
(136, 1, 12, '80bdc6126f3b0839529069fa4a79707a9e4ee8b846b7768574f577a5c0acb00f', '2026-10-24 12:13:52.698', '2026-09-24 12:13:53.444', '2026-09-24 12:13:52.700'),
(137, 1, 12, 'ab738ea9a719860cf7111fba5eda2884a5c117ca0396b6b7827b50520b0f4a9c', '2026-10-24 12:13:53.516', '2026-10-15 13:02:59.497', '2026-09-24 12:13:53.518'),
(138, 1, 12, '0b7394d0eaf62e4ffd2bb57691bd25a40e8003aa79b30db12f65c5b85a810c42', '2026-10-24 12:13:53.665', '2026-09-24 12:14:06.578', '2026-09-24 12:13:53.666'),
(139, 2, 5, '12f1124fd1b16411eea566d9df6de82c94e3e123a586515237bc19a471cb04c9', '2026-10-24 12:14:25.719', '2026-09-24 12:15:39.424', '2026-09-24 12:14:25.720'),
(140, 2, NULL, '13ec3c0ff51acbab10f72be7ee48132a8962867c0940e3cea3d29156f616b897', '2026-10-24 12:14:49.926', NULL, '2026-09-24 12:14:49.927'),
(141, 3, NULL, 'a0ec3a951d7eae8fc3797a43211273c9c0bef063eff8afeedaa14b9d675b0cbc', '2026-10-24 12:15:02.663', NULL, '2026-09-24 12:15:02.664'),
(142, 7, NULL, '60b7dec286b958c8f36bc80479b82db3f717c5f89f50e59c8f60d998e41d4ce0', '2026-10-24 12:15:03.098', NULL, '2026-09-24 12:15:03.100'),
(143, 7, NULL, '304a98529271996e6aac2416f1a83797e37bbf00355ce7cede0acb7c3cf41b36', '2026-10-24 12:15:25.669', NULL, '2026-09-24 12:15:25.670'),
(144, 2, 5, '919ddf49fd7093d2bf047ae988258cec09bf901abbeb19d2db2728523b8ff04c', '2026-10-24 12:15:39.488', NULL, '2026-09-24 12:15:39.489'),
(145, 2, 5, '0d604807c73a6c80d39803ae0bab4a27605a63f5f51a2f86a5f849f60db1eb83', '2026-10-24 12:15:39.553', '2026-09-24 12:28:50.154', '2026-09-24 12:15:39.554'),
(146, 3, 2, 'bd709e98d26af4d6faabe4cfb56bddc75c00b9d9338de39a6c1e6f2ef62806cd', '2026-10-24 12:26:31.206', '2026-09-24 12:39:50.404', '2026-09-24 12:26:31.208'),
(147, 2, 5, '35910ad89afa324814f7a7af7c349d6bf3f473068a6db79370a7559a4fed22c1', '2026-10-24 12:28:50.203', NULL, '2026-09-24 12:28:50.204'),
(148, 2, 5, '2050786bcda9c7fc2de9294b1a8b9354bdf073e07069b2e34b2ab6f2993591d1', '2026-10-24 12:28:50.206', '2026-09-24 17:38:29.444', '2026-09-24 12:28:50.208'),
(149, 2, NULL, '0e9e070ef6bd1d25f681e1f2798a9b0cb44fc7529fd058ca731dfc341eb1175a', '2026-10-24 12:29:35.750', NULL, '2026-09-24 12:29:35.751'),
(150, 3, NULL, 'c5d6d124c1ca356c2e1f8a84d5fac2a227d26922d6506854bc1048d1794c9347', '2026-10-24 12:29:51.914', NULL, '2026-09-24 12:29:51.915'),
(151, 2, 5, '722391969642dcd11e84caeb5fcd3498fa88b9d492dedb78db24034f233914c7', '2026-10-24 12:37:23.262', NULL, '2026-09-24 12:37:23.264'),
(152, 3, 2, '957f2c2853e7d386b0f6732b2cc5981cc885310584bf7e508514068e5aa8addc', '2026-10-24 12:39:50.521', '2026-09-26 08:07:03.304', '2026-09-24 12:39:50.526'),
(153, 2, 5, 'b195a343731e566e6c07e4f61c3ea6f76af74d21dcceebab07f8293e34145452', '2026-10-24 12:42:05.009', '2026-09-24 17:54:43.824', '2026-09-24 12:42:05.010'),
(154, 2, 5, 'bbcbf6acdb2b1ff4819b3a2dea84fe594caf21b50a3f4e4d265f261b65cab90b', '2026-10-24 17:38:29.534', NULL, '2026-09-24 17:38:29.536'),
(155, 2, 5, '609bf67cbd7718223eca3261665b45e18310626c9ddae1c56add0209171625de', '2026-10-24 17:38:29.549', NULL, '2026-09-24 17:38:29.550'),
(156, 2, 5, '0701b1ea56c72ff11d5061404dd86eb6278e7bff0ac2ec8b92ae83962c9279d4', '2026-10-24 17:38:29.553', '2026-09-26 10:17:26.547', '2026-09-24 17:38:29.555'),
(157, 2, 5, 'eb1eae61bba9c26da6608420f95723a7a07373a266b093cc2aa98b3939567a4f', '2026-10-24 17:38:29.556', NULL, '2026-09-24 17:38:29.558'),
(158, 2, 5, '984a2128cdcecd9ad11b935779ba82fa42cf369631bae0119982c61e07db315c', '2026-10-24 17:54:43.847', NULL, '2026-09-24 17:54:43.849'),
(159, 2, 5, 'f2658701b64b65697c8ac52eb6ba4fe5cff8acafb9d55b55e99484ed56fc68db', '2026-10-24 17:54:43.862', NULL, '2026-09-24 17:54:43.863'),
(160, 2, 5, 'db6c31f679cfe7e9fabe947b11f243e65b796300e40fb59d4b9d0a878d11120e', '2026-10-26 07:56:33.577', NULL, '2026-09-26 07:56:33.579'),
(161, 2, 5, '093390ae163c6eb53df7359cdb3dfc30495c102c9071f4cd6c9fbb7efbf83143', '2026-10-26 07:56:33.581', '2026-09-26 07:56:50.689', '2026-09-26 07:56:33.583'),
(162, 3, 6, '36ec6f189bd33f2fa38588a47ccd6b2942cc9245e63e703d56835d58332b02a5', '2026-10-26 07:57:03.715', '2026-09-26 07:57:06.976', '2026-09-26 07:57:03.717'),
(163, 1, 12, '409d4c2c8471dc1dd49a4398f2d0bfc259ac6264a208f6a422041e19ce0ea615', '2026-10-26 07:57:16.035', '2026-09-26 08:01:25.327', '2026-09-26 07:57:16.037'),
(164, 2, 5, '9ffe1e24a41c154643677218ba324191e224e9f8e1af0a96361ce0bd8bc0b117', '2026-10-26 08:01:26.926', '2026-09-26 08:34:11.367', '2026-09-26 08:01:26.927'),
(165, 3, 2, '5dbeae8d73ba87bb86bc7466ed037bfd11fd786762f57f1aaee1d555f5c5fd62', '2026-10-26 08:07:03.323', '2026-09-26 08:22:03.431', '2026-09-26 08:07:03.325'),
(166, 3, 2, 'cd005e84b9c340034ea15e32e082edc49aeca80c60a45e52363a4300db992812', '2026-10-26 08:22:03.444', '2026-09-26 08:34:27.895', '2026-09-26 08:22:03.445'),
(167, 2, 5, 'e52999014b133957b67bff6e67ac7c9abb7ebe55c1e8801f63c1fe9f1b2617d5', '2026-10-26 08:34:11.403', NULL, '2026-09-26 08:34:11.405'),
(168, 2, 5, 'c03ac35034f41640cf5ee850dadaa7c90fb944c7b35d0f7601b8fba57b77a817', '2026-10-26 08:34:11.422', NULL, '2026-09-26 08:34:11.423'),
(169, 2, 5, '3d0f54aaeaa509c372ab88805917305baafd30f22914f29a7b39d2b8e0dd649a', '2026-10-26 10:17:26.592', NULL, '2026-09-26 10:17:26.594'),
(170, 2, 5, '95389286f2c598946dcfc502d504d68e67365c3b5f8d635db6a771835211e8a2', '2026-10-26 10:17:26.609', NULL, '2026-09-26 10:17:26.611'),
(171, 2, 5, '48ac62192d849ed6f289895033ee61211005bff15872bef6f4113b42e229d55e', '2026-10-26 10:19:16.913', '2026-09-26 10:42:52.302', '2026-09-26 10:19:16.914'),
(172, 2, 5, '8146c174e5073718168b54bfa1233f8efd61b4f10c4793af08f1004fe6bf20ef', '2026-10-26 10:42:52.316', NULL, '2026-09-26 10:42:52.317'),
(173, 2, 5, '618cb1b27dda7eb77b9743b1057a180cd5358df7353cdad4c290ab14e7d8d0f9', '2026-10-26 10:42:52.322', '2026-09-26 11:05:32.314', '2026-09-26 10:42:52.323'),
(174, 2, 5, 'eb213ad77d768e48ff42daa12576a51c6be105052d905f64860e8e2ab0842e76', '2026-10-26 11:05:32.325', NULL, '2026-09-26 11:05:32.326'),
(175, 2, 5, '9f49ee93112da6e80cf209efbdfcb15271b0e0131e6dec2bcacd76c88ba7d0e8', '2026-10-26 11:05:32.329', '2026-09-26 11:21:58.620', '2026-09-26 11:05:32.331'),
(176, 3, 2, '03b3ee523562b233b50ea09703a3e776bfa7a85384cff00e5cf7db0774b5fd7d', '2026-10-26 11:05:47.429', '2026-09-26 11:10:25.154', '2026-09-26 11:05:47.431'),
(177, 3, 2, 'd7364b61aee9faf4a0d2320d861d12991bcab79f0998a227cc6dd95907bae914', '2026-10-26 11:10:25.181', '2026-09-26 11:10:49.638', '2026-09-26 11:10:25.184'),
(178, 3, 2, 'a643f842700ba64ff2fb80c6d4dcb9dc5079140840e186823f7adb5c880c8021', '2026-10-26 11:10:49.660', '2026-09-26 11:25:49.733', '2026-09-26 11:10:49.662'),
(179, 2, 5, '71683d90ce137708e46aedbe40ab47b5c56115420cf8a89b7c57f6e18bef758c', '2026-10-26 11:21:58.689', NULL, '2026-09-26 11:21:58.690'),
(180, 2, 5, '584e41d1bc84bceac9b17a7fdce14cb0b5db608e2aa5f8825277e5ac0cfedad8', '2026-10-26 11:21:58.785', NULL, '2026-09-26 11:21:58.786'),
(181, 3, 2, 'cd04d4d02a0501cc7ed46d7e83a20cf5bb975895c7db13f2b3fbc38971ef41a4', '2026-10-26 11:25:49.859', '2026-09-26 11:25:59.918', '2026-09-26 11:25:49.860'),
(182, 7, 18, '357e9ca204bd01ff99b154ce77df2335cce919e2c53fe3d748f72cb299c7a195', '2026-10-26 11:26:08.035', '2026-09-26 11:41:13.838', '2026-09-26 11:26:08.037'),
(183, 2, 5, '16e70986967f107cbc14fb959f09c11cf2d6e1552b22a74e394e7a78ffa15004', '2026-10-26 11:28:39.214', NULL, '2026-09-26 11:28:39.216'),
(184, 7, 18, 'bba66ee3e20c334e81927a92a62a748617a3e766ac1cc292d1414615dad1ef06', '2026-10-26 11:41:13.860', '2026-09-26 11:56:13.857', '2026-09-26 11:41:13.861'),
(185, 7, 18, '2b68ef9821a14e5efc5558bcf388f24e0667bfc13e91643cd76e643b1b5ce132', '2026-10-26 11:56:13.882', '2026-09-26 12:11:13.948', '2026-09-26 11:56:13.884'),
(186, 7, 18, 'e12a3ddaa546e320ad8b0c3236f7035780d1c241a2b829d5332e0b0d0aca6193', '2026-10-26 12:11:14.216', '2026-10-03 08:25:07.235', '2026-09-26 12:11:14.217'),
(187, 2, 5, '81f6ab8c84ef2e6fff38978e610474fc33381d65a40464f21560dab363084ce1', '2026-11-02 08:24:06.857', NULL, '2026-10-03 08:24:06.859'),
(188, 7, 18, 'fc42134599e0e9a27c004cc1d3360dc1bddd9ef3fceef791031d541915cdf514', '2026-11-02 08:25:07.373', '2026-10-03 08:25:28.792', '2026-10-03 08:25:07.375'),
(189, 3, 2, 'ae9588f11a7b08b46db3bc5a4cdf9e1afa6af62a14c8e3494977e265e6a6705a', '2026-11-02 08:25:32.063', '2026-10-03 08:29:54.192', '2026-10-03 08:25:32.065'),
(190, 3, 2, '87faad627ac97ade5d6e4a7cd98fd407bcf5ff3e817bccafbb674099b475ad52', '2026-11-02 08:29:54.237', '2026-10-03 08:30:43.908', '2026-10-03 08:29:54.239'),
(191, 3, 2, 'ab3877bbf5e585217c134806a6576ac824a75fb85435db3e7965f80a45b509fc', '2026-11-02 08:30:43.927', '2026-10-03 08:31:03.143', '2026-10-03 08:30:43.929'),
(192, 3, 2, '48600e6513b23e7a47c9c93156720588403ede38ef1e1fa91f235ba6c6bee95c', '2026-11-02 08:31:03.171', '2026-10-03 08:31:16.999', '2026-10-03 08:31:03.173'),
(193, 3, 2, 'fc2b6ee68b77a6f310b232735e8c3bf73c331a90088f7eb6069c6911bf2a23c1', '2026-11-02 08:31:18.447', '2026-10-03 08:32:31.959', '2026-10-03 08:31:18.448'),
(194, 3, 2, 'bbbbf20a22af839c3d8b2d985260ff9b5650328beb9bfeb6b7c74c7fc36ded6b', '2026-11-02 08:32:31.996', '2026-10-03 08:32:50.956', '2026-10-03 08:32:31.997'),
(195, 7, 18, 'f7d7d1e572128e2a194e309fb22980834430141ae95e8560d4cbbedc0ffd2e49', '2026-11-02 08:33:01.026', '2026-10-03 08:48:45.575', '2026-10-03 08:33:01.028'),
(196, 7, 18, 'c5dadcbee9298cf2df9352458e951d0834443b2eb6d525f20b8f2fef70037f96', '2026-11-02 08:48:45.612', '2026-10-03 09:03:45.616', '2026-10-03 08:48:45.613'),
(197, 7, 18, '63c36b1f32f9d49204fdf2864c276fff4692dd04c6c7f4c540310ea0771e7ba2', '2026-11-02 09:03:45.636', '2026-10-03 09:18:45.590', '2026-10-03 09:03:45.638'),
(198, 7, 18, 'e261c09684eee8b7a6d1fc6b94606173294cd3de66cd2e0b5e56921514217b59', '2026-11-02 09:18:45.668', '2026-10-03 09:33:45.577', '2026-10-03 09:18:45.669'),
(199, 7, 18, 'afa8ec675eb847be4777646472f3883e0bdf0ddbf7ebeb55e0b4c18305c542a2', '2026-11-02 09:33:45.615', '2026-10-03 09:48:45.538', '2026-10-03 09:33:45.616'),
(200, 7, 18, '6c69cab32edc82cf8e6b66374bb48d377569b0248e811fbb8df1cf2045e235d7', '2026-11-02 09:48:45.617', '2026-10-03 10:03:46.126', '2026-10-03 09:48:45.618'),
(201, 7, 18, 'ce2f7d99e1a49ab7ea1bd0a22a14ceac8871e0e62504680e0a33c6f052bc6acf', '2026-11-02 10:03:46.438', '2026-10-03 10:19:45.555', '2026-10-03 10:03:46.441'),
(202, 7, 18, 'c262f193faaaccd573c24ae0bf2fc7c401f85d9c281757a770f490eb3c341c9d', '2026-11-02 10:19:45.568', '2026-10-03 10:34:45.559', '2026-10-03 10:19:45.570'),
(203, 7, 18, 'cb9d03027e7948225e81ace7cf840eadfa4850f6cdd734ee2b690b3bb7bf3e7d', '2026-11-02 10:34:45.574', '2026-10-03 10:49:45.563', '2026-10-03 10:34:45.576'),
(204, 7, 18, '907f9b24f8f7c13e217ebf7ae73908dda2cef8dda491efb72c94d2a044eaeef1', '2026-11-02 10:49:45.577', '2026-10-03 11:04:45.550', '2026-10-03 10:49:45.579'),
(205, 7, 18, '4fd8f8c23b58aba45304c5a302e11d2c385cded72f7d0db12a95d600e120bf23', '2026-11-02 11:04:45.565', '2026-10-03 11:19:45.512', '2026-10-03 11:04:45.567'),
(206, 7, 18, '9e94ac9d9fe4bdb83bd644c623a7858246bfc5edfa83bf8928807bf2b994e37b', '2026-11-02 11:19:45.551', '2026-10-03 11:24:30.083', '2026-10-03 11:19:45.552'),
(207, 7, 18, 'e8d443c03f49e0dc9da8527abc4d83f0571b2cf4f95eb3045b2d3d9327feb541', '2026-11-02 11:24:30.100', '2026-10-03 11:39:30.177', '2026-10-03 11:24:30.102'),
(208, 7, 18, 'c36b64dcf929cc545993d827107d1ad6688c92a337cc153258d1a1bb75a0f4be', '2026-11-02 11:39:30.342', '2026-10-03 11:54:30.473', '2026-10-03 11:39:30.344'),
(209, 7, 18, '0da1947bb451f71f54c759e79a397e842606f2f73e9c8ed1f604349ec8214ce2', '2026-11-02 11:54:30.526', NULL, '2026-10-03 11:54:30.528'),
(210, 3, NULL, '79a511e93ba99f2343d3975db9d2af49fbb367f8a3021c95bc548bc6e40d4730', '2026-11-07 06:38:57.618', NULL, '2026-10-08 06:38:57.620'),
(211, 2, NULL, 'f7fa9ebab8ed07c10c8c5bf80999870c69855e1ffb1609b8eaa8a0f07586a615', '2026-11-07 06:38:59.343', NULL, '2026-10-08 06:38:59.345'),
(212, 2, 5, '4e3511744739358af21cb56bf97f281e062b4d6b8f8bc2e1134e300a3655be37', '2026-11-07 06:39:25.932', '2026-10-08 06:39:46.460', '2026-10-08 06:39:25.934'),
(213, 3, NULL, 'f22d5c7baf6ac52293f88aaa1fe13c2f80002baadcc3f58680740950d3ecf496', '2026-11-07 06:39:37.834', NULL, '2026-10-08 06:39:37.836'),
(214, 2, 5, 'cbf6ca0a5b0f8e9427a686c0cf3cac4b53ae1e70f629d2d6ba692d2ddfa0e6e8', '2026-11-07 06:39:46.544', NULL, '2026-10-08 06:39:46.546'),
(215, 2, 5, 'c751ee735d7587bf4c926e760eb9e30dfbf375ef30d67d66e767e0532c13d531', '2026-11-09 22:22:15.836', '2026-10-10 22:24:07.225', '2026-10-10 22:22:15.839'),
(216, 2, 5, '6efa807a8e8784a96aaefa3a01445640d29c98e892daf8e1b8c8a3ffddc68a1e', '2026-11-09 22:24:07.829', NULL, '2026-10-10 22:24:07.831'),
(217, 2, 5, '15ec09e6705d9c7c2cc9c978684c7043740e5dc91d6db3eb3ff67a0eadb34207', '2026-11-09 22:24:08.079', NULL, '2026-10-10 22:24:08.081'),
(218, 3, NULL, '860f3714663747aae94ff5f4840f89260516592daa8a5373d39e1eb8deca8c99', '2026-11-09 22:49:01.804', NULL, '2026-10-10 22:49:01.806'),
(219, 3, NULL, '5ce4f7fe27f1f262a6a26a8d1ee070912cd83815b3c9625e0754ba2f79bc28c8', '2026-11-09 22:50:42.206', NULL, '2026-10-10 22:50:42.209'),
(220, 2, 5, 'e461734b3662fedb1c600771f38db9bce8a576014bfaff437b2b89cad2569aa3', '2026-11-09 22:50:54.048', '2026-10-10 22:56:59.258', '2026-10-10 22:50:54.051'),
(221, 1, 12, '9d710e8ac62d39c10506099232c80bb91e8602701cfbe8b5509f1633fcbf753d', '2026-11-09 22:57:21.066', '2026-10-10 22:57:44.430', '2026-10-10 22:57:21.067'),
(222, 2, 5, '5ce89f448d28ef0906e455063fa24d6006e44e4f13893d2726e83e349509e958', '2026-11-09 22:57:54.125', '2026-10-10 23:10:06.912', '2026-10-10 22:57:54.127'),
(223, 3, 2, '2335f7f77dabda36a8452c9beb3f95ddccfe80b1c80db87afefc4bcbe4bd3825', '2026-11-09 23:06:56.997', '2026-10-10 23:07:10.727', '2026-10-10 23:06:57.000'),
(224, 7, 18, 'd98f9e15f198edda0b4b055938dd1ec6eb1befe08bcbb3cacc9fbc3a710b3347', '2026-11-09 23:07:22.380', '2026-10-10 23:11:22.196', '2026-10-10 23:07:22.382'),
(225, 2, 5, 'bf0b6233af40e73e106da007be3604326294feb2d1df6e5b8e922101905fdf31', '2026-11-09 23:10:07.077', NULL, '2026-10-10 23:10:07.079'),
(226, 2, 5, 'ebe251293c5f4a2b7b1488b73a475900ee736e6bfaaad02eac950e1e9cd9abd3', '2026-11-09 23:10:07.358', NULL, '2026-10-10 23:10:07.361'),
(227, 3, 2, '70ebc928729f92eac401ff8e4c739fec7b67b4cfe83b96cd38f4210c7fbeae70', '2026-11-09 23:11:29.716', '2026-10-10 23:11:52.380', '2026-10-10 23:11:29.718'),
(228, 2, 5, '139774ebe4bad6b1950f7cd210ea25e5925437e62ed58bd372e7ecfa591980a5', '2026-11-10 18:47:16.873', '2026-10-11 18:47:25.212', '2026-10-11 18:47:16.876'),
(229, 1, 12, 'c46df7895edccc7e194e860239df7d7e3e4e10eb9008425de3cd12ce225c05f9', '2026-11-11 17:58:49.131', '2026-10-12 17:59:03.032', '2026-10-12 17:58:49.132'),
(230, 8, 19, '86cc13dc1a8d2eb42b8cc911d4b00b3d225393d080751039bec3f9d56099a093', '2026-11-11 17:59:51.310', '2026-10-12 19:50:50.814', '2026-10-12 17:59:51.311'),
(231, 8, 19, 'b8e163d48febd1aad8e4ea6758806dd57a7a85b9f748b81e0f279f2029cf7807', '2026-11-11 19:50:50.826', '2026-10-12 19:50:56.845', '2026-10-12 19:50:50.828'),
(232, 8, 19, 'a271c8dcc4219b713889c700bdff50fe1253f5ad7fdc16e10aa000cc0e425bc3', '2026-11-11 19:52:08.007', '2026-10-12 19:52:12.603', '2026-10-12 19:52:08.009'),
(233, 3, 2, '8b45eca9ee73de7d9161426d7ae2d3f5bbb181680ece46f296754d1f179c657a', '2026-11-11 19:59:43.320', '2026-10-12 19:59:52.158', '2026-10-12 19:59:43.321'),
(234, 8, 19, '4d2dfa6a3c77b344c26e6553fa5f632b54d2096decb0e0254c7087b5d4de2efc', '2026-11-11 20:01:00.627', '2026-10-12 20:03:25.059', '2026-10-12 20:01:00.628'),
(235, 9, 20, 'ddd9c7ccc144adcf837fb23d67f843ceaae3bc04f41db2e08a7be276a7ce1569', '2026-11-11 20:01:33.444', '2026-10-12 20:02:50.658', '2026-10-12 20:01:33.444'),
(236, 8, 19, '702cb4e0852e97db0be7431e3859a0481ee4245c8c292e1053394ce5961e9954', '2026-11-11 20:06:03.638', '2026-10-13 08:07:50.505', '2026-10-12 20:06:03.639'),
(237, 8, 21, '167211ec8d1a5c688e5be8aa503e2c34e4e713513c45c2ad242ae2588979d507', '2026-11-11 20:07:32.043', NULL, '2026-10-12 20:07:32.044'),
(238, 8, 19, '316342d77c4876cda97dfa33b52455f60baf885250b39010496971b14b07a4ce', '2026-11-12 08:07:50.547', '2026-10-13 10:22:19.450', '2026-10-13 08:07:50.549'),
(239, 8, 21, '878aae82ffbf90ec02b84bfb3fe78634a68ffa9f72c8b02f21c29f8f3a0c5e3f', '2026-11-12 08:21:39.434', '2026-10-13 08:22:45.282', '2026-10-13 08:21:39.435'),
(240, 9, 20, 'c676a7f9166e9c2ad2d5c57384fb90e9a60f72397f56c2868553d44dd725d0a2', '2026-11-12 08:22:55.590', '2026-10-13 08:41:07.330', '2026-10-13 08:22:55.591'),
(241, 9, 20, 'acbde83eadbf0850b44b3ac21d65e8041a5ced9f95ad252e2b1b2c5927c00c13', '2026-11-12 08:41:07.335', NULL, '2026-10-13 08:41:07.336'),
(242, 8, 19, '95aa770286e76ca1cab822241154cf6f46d7853f5ad6a49e8f533da22e543551', '2026-11-12 08:42:55.785', '2026-10-13 10:12:09.290', '2026-10-13 08:42:55.786'),
(243, 11, 22, '76ac7f23dd376ed78d032a4ab9d21e89248a4b4c616a92566e0cbe18b7f8cafa', '2026-11-12 08:44:49.338', NULL, '2026-10-13 08:44:49.339'),
(244, 11, 22, '53e2cd4fc5c5979dc5058feb02e6a2508d1d6ce04ebfd1e1118f96adae7e3a81', '2026-11-12 08:50:35.957', '2026-10-13 08:57:18.449', '2026-10-13 08:50:35.958'),
(245, 11, 22, '34151cedcf09f09b7870e7569e8c8fd68dfb92baceeb555e6de8d4549b4e6c3e', '2026-11-12 08:57:18.455', '2026-10-13 08:59:31.190', '2026-10-13 08:57:18.455'),
(246, 11, 22, '848da84a446b19c874361583ff97d36cf88701f6b1f3d83e37aa2a2054bc3b48', '2026-11-12 08:59:31.194', NULL, '2026-10-13 08:59:31.194'),
(247, 8, 19, 'b02274d5828f0d888ce38138b7640baefe0857a8c6fd44dae9fed0fe45ffddf6', '2026-11-12 10:12:09.334', '2026-10-13 10:39:52.132', '2026-10-13 10:12:09.336'),
(248, 11, 22, 'e67befefa3b7c3b3805e2ea4c3c09764ef5f15109266062216d0fcd56ace8938', '2026-11-12 10:12:27.155', '2026-10-13 10:34:01.035', '2026-10-13 10:12:27.157'),
(249, 11, 22, '7c7a1d9241525ba6118c1df60bd162c1b0184fbf3787a3bce6d4405cb7173ea2', '2026-11-12 10:21:02.164', NULL, '2026-10-13 10:21:02.165'),
(250, 8, 19, 'fd8ac3e1360bdf25351e1160653f81fd259576fe60dd7572fb16bf292813ac21', '2026-11-12 10:22:19.456', '2026-10-13 18:46:06.674', '2026-10-13 10:22:19.457'),
(251, 11, 22, '67e7537306e31003f65417490a21fd8b00e5eccf0a19b6b134f27fb2c66334dc', '2026-11-12 10:34:01.051', '2026-10-13 10:34:02.006', '2026-10-13 10:34:01.052'),
(252, 11, 22, '19d393d97a75a63c3e7a254abec3b53eeb8d9221085b7fcaa5b23de3fa749026', '2026-11-12 10:34:02.127', '2026-10-13 10:49:09.789', '2026-10-13 10:34:02.128'),
(253, 8, 19, '426196d754134556eb87c58ccf58725f8a8950fc965e22667d580c12ca52a41a', '2026-11-12 10:39:52.146', '2026-10-13 11:40:33.574', '2026-10-13 10:39:52.147'),
(254, 11, 22, 'bc51b2a37fc306acf67e0838a4afc9da2921d9a2c121c1da562b4ddd38c066e8', '2026-11-12 10:49:09.793', '2026-10-13 11:04:12.483', '2026-10-13 10:49:09.794'),
(255, 8, 19, 'dbf4b008438bb09a76832d6eec2e9d19f26e26251623f12c820b58dd0879fd0f', '2026-11-12 10:49:49.706', '2026-10-13 10:52:18.691', '2026-10-13 10:49:49.708'),
(256, 8, 19, 'c3cd61652c7045a88b4272f2502b2aa667ed0aa5b2a387494237b50d6a16248a', '2026-11-12 10:52:18.886', NULL, '2026-10-13 10:52:18.887'),
(257, 8, 19, 'b01e4c3d559eb832052d00cd42f7bda7ef895f364f8f91ea49179ae8bb2439c6', '2026-11-12 10:52:19.175', '2026-10-13 11:01:25.272', '2026-10-13 10:52:19.179'),
(258, 8, 19, '2c6022b240a9107843c137334efbce5806709d1d974c83d946d873b463f33e49', '2026-11-12 11:01:25.312', NULL, '2026-10-13 11:01:25.314'),
(259, 8, 19, '4c6f4b1ba79a2ab0ab09a7d3cb7789b9a82449540cb906f4326d9dc50a1ee755', '2026-11-12 11:01:25.513', '2026-10-15 12:38:52.113', '2026-10-13 11:01:25.515'),
(260, 11, 22, '74dd39d5fc46261eb5786ff473a49451d79b05c2ba19620ba692b392afd6b159', '2026-11-12 11:04:12.490', NULL, '2026-10-13 11:04:12.491'),
(261, 8, 19, 'e5b44be9534c76c18ccc16a34fff59998bffd3e13be8267de39733d38ba6520c', '2026-11-12 11:40:33.591', '2026-10-13 12:04:35.629', '2026-10-13 11:40:33.592'),
(262, 11, 22, 'c9bd687ac69dcc2e719abd0853bb600369601f57c44d64e31a7ad0cf7b37d571', '2026-11-12 12:01:14.667', '2026-10-13 12:16:29.411', '2026-10-13 12:01:14.668'),
(263, 8, 19, 'a7f931d97b1d7bd953507bb8ef992ea6c547a794a51e7b0afa2f82f758476ebf', '2026-11-12 12:04:35.646', '2026-10-13 12:34:48.169', '2026-10-13 12:04:35.648'),
(264, 11, 22, '6f0c11a2100fb751d79721476153ccb0862409e06a81ae55edd469d53eba70d3', '2026-11-12 12:16:29.427', '2026-10-13 12:16:30.009', '2026-10-13 12:16:29.428'),
(265, 11, 22, '49c02e84c74a1f2a5885ef829b8e38e32b2b57197e1dafbf8b40492893506c26', '2026-11-12 12:16:30.029', '2026-10-13 12:31:58.114', '2026-10-13 12:16:30.031'),
(266, 11, 22, 'aea0b0c1b09e2717879ae9bc512cccc8c46febdb356f9ba7ce368c44a7f49e07', '2026-11-12 12:31:58.119', '2026-10-13 12:31:58.478', '2026-10-13 12:31:58.119'),
(267, 11, 22, '66a9e0f7e8a1669eb457fa1572eddd21a848b437d512b4bad168234fbf1b6110', '2026-11-12 12:31:58.494', '2026-10-13 12:31:58.899', '2026-10-13 12:31:58.494'),
(268, 11, 22, '37d7641069dd086806dd7d9c954a86f241030bdc697eeab4950f02760b30e3f8', '2026-11-12 12:31:58.910', '2026-10-13 12:33:32.240', '2026-10-13 12:31:58.910'),
(269, 11, 22, '50ac1a5487df5afacd6cdd8a3d34d62d2289fcc2716e71aeeeb2f8c3f80da45a', '2026-11-12 12:33:32.255', '2026-10-13 12:44:49.125', '2026-10-13 12:33:32.255'),
(270, 8, 19, '919d53850415693ef37756ef232202cd802b08a0d6b52b285367db4ccb0f0ef6', '2026-11-12 12:34:48.179', '2026-10-13 18:26:27.054', '2026-10-13 12:34:48.180'),
(271, 11, 22, '4c0d94e9f063389d6f3951e0ea350ec38628f6ee210a1914b8d31dd163ed38d8', '2026-11-12 12:44:49.142', '2026-10-13 12:45:00.507', '2026-10-13 12:44:49.143'),
(272, 11, 22, 'fc7621cace78916a89dec00b9b7d4b50c2bbbb115bfbfae4b549ebd1184c158c', '2026-11-12 12:45:00.528', '2026-10-13 12:45:36.494', '2026-10-13 12:45:00.529'),
(273, 11, 22, 'ad49db5e5279d46e46c9ce44c135a5506217244308f831e1ea99868f22d7c9ce', '2026-11-12 12:45:36.508', '2026-10-13 12:47:23.649', '2026-10-13 12:45:36.509'),
(274, 11, 22, 'e06b7f1c4ed4150b891cb747355d9358c8c0e3e93211d732751050920c7b70d3', '2026-11-12 12:47:23.662', '2026-10-13 15:04:49.650', '2026-10-13 12:47:23.663'),
(275, 11, 22, '953d2ea48af0b2c1f07c2afd45babd3875c55799483ab85c2ed5c6d2126d055e', '2026-11-12 15:04:49.654', NULL, '2026-10-13 15:04:49.656'),
(276, 11, 22, '5ceb106cf120467078c3e8556e7f66346e5b28e2e17d2f16b69c99562d6cab79', '2026-11-12 15:04:49.649', '2026-10-13 15:05:08.346', '2026-10-13 15:04:49.650'),
(277, 11, 22, '170f1baf48e27d0a0f417b947d390772f3878d89b6e9d6da1ccf6b7289e90713', '2026-11-12 15:05:08.359', NULL, '2026-10-13 15:05:08.359'),
(278, 8, 19, 'b5c5e236796419e07c2b370bd890c993bb293b0eb5cc5e3f84fb5645216be5b6', '2026-11-12 18:26:27.064', '2026-10-13 18:48:45.193', '2026-10-13 18:26:27.065'),
(279, 11, 22, '6a343f4c49475ac67c055bbbffe5aef27c15375092fe503b51eda051049d592c', '2026-11-12 18:32:28.178', '2026-10-13 18:36:02.995', '2026-10-13 18:32:28.179'),
(280, 8, 21, 'a7c4a53fbf3abfabd6da909ca0b1ca79329dd3f2a034ed681fb9ea9a65b3bbaa', '2026-11-12 18:36:22.395', '2026-10-13 18:44:29.199', '2026-10-13 18:36:22.396'),
(281, 8, 21, 'dc779e2865dcfa3b805688defbabc8bd0845b46bde6e918706d291850f2c4afe', '2026-11-12 18:45:15.766', '2026-10-13 18:46:33.602', '2026-10-13 18:45:15.767'),
(282, 8, 19, '294502d21a0f163705a82b50d9daecebc9a15bd06953752024e30fa4586d3bc3', '2026-11-12 18:46:06.680', '2026-10-22 06:28:13.817', '2026-10-13 18:46:06.681'),
(283, 8, 21, 'f7ec7befaae7d2bee19fc2d4c18e09f95e4edba91c75bdb543f5be3d22ef9a31', '2026-11-12 18:47:13.722', '2026-10-13 18:47:57.020', '2026-10-13 18:47:13.723'),
(284, 13, 23, '2374aec23bc1a1dcb1d781a3feb355be70c0ff0f0981aa287fd0bd0b0450c377', '2026-11-12 18:48:15.728', '2026-10-13 18:52:11.770', '2026-10-13 18:48:15.729'),
(285, 8, 19, '127452880c1650dbf557ca67b8080100ba7abde4da840392d42bb4bc8dd8e2a5', '2026-11-12 18:48:45.210', '2026-10-13 18:54:30.823', '2026-10-13 18:48:45.211'),
(286, 13, 23, '02c8bb7b6e8102b13ae4f979e5f2d4019dc8198241df05673b52baae6769799e', '2026-11-12 18:52:11.785', '2026-10-14 06:07:16.687', '2026-10-13 18:52:11.786'),
(287, 8, 19, 'a772ddb6e92438820099f9fa571bbcca5e0392b67accdc62fd210af4d9d35569', '2026-11-12 18:54:30.839', '2026-10-14 08:12:54.006', '2026-10-13 18:54:30.840'),
(288, 13, 23, '24941fe0eb14adee9cb20f9dba437466fde3f4d577110091b53a094d602c1a93', '2026-11-13 06:07:16.722', '2026-10-14 08:09:57.906', '2026-10-14 06:07:16.723'),
(289, 13, 23, '33702ba06abb3f8121d5a46464c3bfa037225b6ccf1102cc4c7ad60bd2de4197', '2026-11-13 06:07:16.723', NULL, '2026-10-14 06:07:16.724'),
(290, 13, 23, '3e9e9a0b05be4975d35889e55158b6dab208a45326b244f6a06ef484a9f17d7a', '2026-11-13 08:09:57.916', NULL, '2026-10-14 08:09:57.917'),
(291, 13, 23, '6fd8b0ca1088bf92c27ea179e3e19c45b77769b6e7db339923dfdb90a9968560', '2026-11-13 08:09:57.921', '2026-10-14 08:12:07.213', '2026-10-14 08:09:57.922'),
(292, 8, 19, 'd6ca6f443b55aec6bace6c948af2eda4ffc7911200312863d76f3144d5a31c24', '2026-11-13 08:12:54.021', '2026-10-15 08:44:14.927', '2026-10-14 08:12:54.022'),
(293, 11, 22, '8db59f95f54e7e35f60c1567cd9600fadc8d52226d2ee809f2363a1776e88c2c', '2026-11-13 08:13:32.959', '2026-10-14 08:28:41.663', '2026-10-14 08:13:32.960'),
(294, 11, 22, '00e7953511f68bbdce48607c2d60243172a128c67da264f8d029c126ce3bdaa5', '2026-11-13 08:28:41.678', '2026-10-14 08:28:42.357', '2026-10-14 08:28:41.680'),
(295, 11, 22, '12ee2797aec02be10e8f152b38f1fba4b9f02b029ede50f7a0cd39521f6cbd6e', '2026-11-13 08:28:42.373', '2026-10-15 19:33:27.415', '2026-10-14 08:28:42.374'),
(296, 8, 19, '819f97a192a1ebfe91650a584df6b3a96b507ebe1e009a8f557da9679f833f9e', '2026-11-14 08:44:14.949', '2026-10-15 08:45:39.114', '2026-10-15 08:44:14.950'),
(297, 1, 24, '73bcde4c9012e3d80efb00db74764dd34e290c0c51fba1837433be2359718c8e', '2026-11-14 09:01:16.282', '2026-10-15 13:02:59.497', '2026-10-15 09:01:16.283'),
(298, 1, 12, '5642a2aa83d17ccfd93c7771b2c9d46572f0ae1e602508af9015805e89ebd5d1', '2026-11-14 09:04:19.985', '2026-10-15 13:02:59.497', '2026-10-15 09:04:19.986'),
(299, 8, 19, '0be7e26735d0c4f2c3185293944334eee2d62f55fb99e53d1e50080f66e9c466', '2026-11-14 12:38:52.436', NULL, '2026-10-15 12:38:52.437'),
(300, 8, 19, '540c8a44fdc217511933d844c450c4c8b4d7bd689f7ce263f09e5d225bb5bb1c', '2026-11-14 12:38:52.523', NULL, '2026-10-15 12:38:52.525'),
(301, 2, 5, 'a7428a58bc21dbf7081980582b2ed32921d9cd5fa9376608ac92391e0ce4fa0f', '2026-11-14 12:46:33.343', '2026-10-15 13:01:23.754', '2026-10-15 12:46:33.344'),
(302, 1, 12, 'be5ead89ea8f989854f600bad70f1ea74a479dd6fa8da9bfc212b40f3752fa3d', '2026-11-14 13:03:25.613', '2026-10-15 14:44:36.683', '2026-10-15 13:03:25.615'),
(303, 1, 12, '9ae2f6f28ab36d518ff38ded892d35962032aab34bb7f6324d0baaa39cb57515', '2026-11-14 14:44:37.236', NULL, '2026-10-15 14:44:37.238'),
(304, 1, 12, '6bc46d985e9e4ea397729647fe5ea65e23d0bbf8c7c05b144ef8ed781c364b46', '2026-11-14 14:44:37.395', '2026-10-16 19:37:49.985', '2026-10-15 14:44:37.397'),
(305, 11, 22, '56da71f64c3eaa22182de2d43d46e4a5f031dbc61b3fc5a135288471a25d2b0d', '2026-11-14 19:33:27.449', NULL, '2026-10-15 19:33:27.451'),
(306, 8, 21, 'abcbb6ac59d4e22c1d0a874f4deed99546b7a7c8824dcefe12e8dd854cb6d20d', '2026-11-14 19:33:45.884', '2026-10-16 12:18:35.189', '2026-10-15 19:33:45.885'),
(307, 8, 21, 'fc78792ec167832da9eb0b1e8b285476905983ab90c67f48ac0a4714708a1999', '2026-11-15 12:18:35.210', '2026-10-16 12:23:04.839', '2026-10-16 12:18:35.211'),
(308, 8, 21, 'ed1e22ed034ab3e8490df356f61d7d7d67bc0d91ecfa98eac8f207bd240e4e65', '2026-11-15 12:18:35.208', NULL, '2026-10-16 12:18:35.210'),
(309, 8, 21, '548834b760b037c28d6123015bd3208cd6b1a9723e3831947da89077fe679592', '2026-11-15 12:25:36.350', '2026-10-16 12:25:45.591', '2026-10-16 12:25:36.351'),
(310, 8, 21, '87a4d9f1a4572abd5a101f597010c661806ea55d1792a8a129e68e9d5a0b6c43', '2026-11-15 12:26:17.445', '2026-10-16 12:27:45.162', '2026-10-16 12:26:17.446'),
(311, 11, 22, '93ad1097b2164db15c7ce2180c548ccfe8f9f2edf421e672db0f650855020fe6', '2026-11-15 12:28:19.710', '2026-10-16 13:06:54.669', '2026-10-16 12:28:19.711'),
(312, 11, 22, 'a1daf58a933207565b3c37ac8cc26fbb2b197fd85c7f916d89cbf30dbd61b6df', '2026-11-15 13:06:54.683', '2026-10-16 13:06:55.474', '2026-10-16 13:06:54.684'),
(313, 11, 22, '630b5a9da4f479382b0e55cda58cd60df23b454325e18c6a573cc798c49982bf', '2026-11-15 13:06:55.488', NULL, '2026-10-16 13:06:55.489'),
(314, 8, 19, 'b767a85faad74a357876f31cf7b396dda250fda697b31283dcc8f8b3f62188db', '2026-11-15 15:04:45.987', '2026-10-16 19:00:31.947', '2026-10-16 15:04:45.989'),
(315, 8, 19, '486312aca0808a85e9630718d966fd39a028b5b693aa15d361e3b965861102a3', '2026-11-15 19:00:31.970', '2026-10-16 19:07:19.520', '2026-10-16 19:00:31.971'),
(316, 8, 19, '506b97927f3a0b7215fdea2b62d6d0e567284bfb579eaf1855466974283fcbd2', '2026-11-15 19:07:40.688', '2026-10-16 19:08:02.113', '2026-10-16 19:07:40.689'),
(317, 8, 19, 'aed530a87aa4b59d07759f1771c38379c21f89e137c2303371e001f106b12caa', '2026-11-15 19:08:02.146', '2026-10-16 19:16:02.642', '2026-10-16 19:08:02.147'),
(318, 8, 19, 'fb8921f7f0a431e3a55aedc23faec7066b5efda8b0be819444818d48f3f4815b', '2026-11-15 19:16:02.694', '2026-10-16 19:16:12.819', '2026-10-16 19:16:02.696'),
(319, 8, 19, 'ff0e44dd88cec2dc6769cd53f115cb40563e0625e10815a04f305760294417a4', '2026-11-15 19:16:33.062', NULL, '2026-10-16 19:16:33.063'),
(320, 8, 19, '8b42915857977cb104bf97e658a7bd373105955916eeb2041370d70d7ffa6e14', '2026-11-15 19:23:15.370', '2026-10-16 19:35:42.134', '2026-10-16 19:23:15.371'),
(321, 2, NULL, '28deb97e27f3642e2145479b3a9099692f978a30556611360a6f885e047f362e', '2026-11-15 19:28:10.334', NULL, '2026-10-16 19:28:10.336'),
(322, 3, NULL, '64bb6230f387f756993975b49ae80dfbab9f74191f48bb22ee92aa2c4edfdef3', '2026-11-15 19:28:11.090', NULL, '2026-10-16 19:28:11.091'),
(323, 2, NULL, 'abf5b049274cc182850e9b8f6f6887c236135a154045953580072718a2e059d4', '2026-11-15 19:30:50.888', NULL, '2026-10-16 19:30:50.890'),
(324, 3, NULL, 'c71abc4d1f988762250776eba71ff397786d16b3a65d602933fe9329a921222f', '2026-11-15 19:30:51.767', NULL, '2026-10-16 19:30:51.769'),
(325, 2, NULL, '9340957b1ad8f2c2e8b77ec9eb9c0f387d74be368bf73279b8b52d4d743b883e', '2026-11-15 19:31:38.939', NULL, '2026-10-16 19:31:38.940'),
(326, 3, NULL, '1c34c1e07702720801b62901b2dda9589d1fa55448653dfe8c7bfeea55eeb887', '2026-11-15 19:31:39.113', NULL, '2026-10-16 19:31:39.114');
INSERT INTO `refreshtoken` (`id`, `userId`, `deviceId`, `tokenHash`, `expiresAt`, `revokedAt`, `createdAt`) VALUES
(327, 8, 19, 'dac74a60e19e0d31fadf378458dcc5b26902600f0caef2ceb2b936aa518079f7', '2026-11-15 19:35:42.150', '2026-10-16 19:35:46.795', '2026-10-16 19:35:42.151'),
(328, 8, 19, '4e1824f68c0b82f08166c6fb5a303e2192de8c3daf3a2b6994ba70352271384d', '2026-11-15 19:36:06.463', '2026-10-16 19:42:53.255', '2026-10-16 19:36:06.464'),
(329, 1, 12, '63310a6f7a500d7f20779c54c5f57b8eed29a42db740d6e56c526ba24e3aa8a1', '2026-11-15 19:37:50.422', NULL, '2026-10-16 19:37:50.424'),
(330, 1, 12, '038d2089f6f10993e66fc088bdd73e25f9b138107a6c92bc68a62b861f1fcdb5', '2026-11-15 19:37:50.625', '2026-10-16 19:38:13.369', '2026-10-16 19:37:50.628'),
(331, 8, 19, '88ecbd4df7f5b76c53bc65e61b77443485dcdd5014680915e9f82a219649c0b4', '2026-11-15 19:38:31.361', '2026-10-16 20:08:41.098', '2026-10-16 19:38:31.363'),
(332, 2, NULL, 'dae400372849c73307c0b91534401885fdd0fb578603f2d587aa521815fa876b', '2026-11-15 19:41:43.997', NULL, '2026-10-16 19:41:43.998'),
(333, 8, 19, '76617855281380f81b84e9e0ed9ef240f73ca9c3734f0f3de73370a7290b4aef', '2026-11-15 19:42:53.261', '2026-10-16 19:46:49.287', '2026-10-16 19:42:53.262'),
(334, 2, NULL, '0cc7add4d70df486643fc133f8c6eab5dfcd8883aabbc4b8537874bbab9797d6', '2026-11-15 19:46:01.500', NULL, '2026-10-16 19:46:01.503'),
(335, 3, NULL, 'eb4cab29540c5a4902a4c82f92683359c5e4f8f664cd6ccbdb39414067e56387', '2026-11-15 19:46:02.167', NULL, '2026-10-16 19:46:02.168'),
(336, 8, 19, 'f74b25716f8cf855a6ccd419068b16824cbec1164fbd2d46b64af70ed620c9ca', '2026-11-15 19:47:22.331', '2026-10-16 19:50:13.818', '2026-10-16 19:47:22.332'),
(337, 2, NULL, '1a3930d1417487f90bcad94618b0be6ff5e02bfba625a5737de63b399f8c91a6', '2026-11-15 19:48:56.930', NULL, '2026-10-16 19:48:56.931'),
(338, 2, 5, 'd079c4bc29019b6265f633e1220988c4bdb4c701ae91ada76701ba67529f41e3', '2026-11-15 19:50:32.769', '2026-10-16 20:06:28.109', '2026-10-16 19:50:32.770'),
(339, 8, 19, '3f005adf409f57f67534251a572fd4fa1a5d9993a9d5693855d46bb7b4286bda', '2026-11-15 20:06:43.180', '2026-10-16 20:37:55.131', '2026-10-16 20:06:43.181'),
(340, 8, 19, '9df21c03a5cddfcb047c23ee85d221f66c27643e5dc77aed90a2a58d2d0e70bc', '2026-11-15 20:08:41.624', NULL, '2026-10-16 20:08:41.625'),
(341, 8, 19, 'b0de037528e2d3f1a5690eac5bc0c284a3ab26349fe45d7fa29d3b5a5455afa2', '2026-11-15 20:08:41.776', '2026-10-16 20:14:51.649', '2026-10-16 20:08:41.777'),
(342, 8, 19, '93c8033bf426739cec859af8f9adc80a23c805c7d954b9f99d76aab44e930fc4', '2026-11-15 20:14:51.869', NULL, '2026-10-16 20:14:51.870'),
(343, 8, 19, 'ab8dda23ca9987fec2892d04242784cd5c50b04b885086d9bcc286b683df8a4e', '2026-11-15 20:14:52.171', '2026-10-16 20:14:58.251', '2026-10-16 20:14:52.173'),
(344, 8, 19, '3d52310594e01df665abed72918514755d161c422d0ca10bbbca117b5736e343', '2026-11-15 20:14:57.839', NULL, '2026-10-16 20:14:57.840'),
(345, 8, 19, '3d0d9d9b15b46b834fb5bbefbd8f992e621c2839f5344ba10b89ea9f5d95e467', '2026-11-15 20:14:58.819', '2026-10-16 21:26:50.450', '2026-10-16 20:14:58.820'),
(346, 8, 19, 'b261953f8aa925ebd579039178978e97ec7cf2af9ade48b40dfa1c15143137c5', '2026-11-15 20:37:55.148', '2026-10-16 20:38:55.562', '2026-10-16 20:37:55.149'),
(347, 1, 12, '217b4683fd90b0c12e46119213820c847e6b37fed0ac513ccca9bbd0c9a88775', '2026-11-15 20:39:38.707', '2026-10-16 20:43:11.165', '2026-10-16 20:39:38.708'),
(348, 1, 3, '9e4a1e8f423edc60218f85dc211ff7fb79c00078608aab51b16d5df23d54ae7c', '2026-11-15 20:57:26.973', '2026-10-16 20:58:03.270', '2026-10-16 20:57:26.974'),
(349, 8, 21, '8f23a22e0076f4babee98743ac2c6054cc90ddce3f6b856c8281651f683f204c', '2026-11-15 20:58:20.554', '2026-10-16 21:03:27.829', '2026-10-16 20:58:20.555'),
(350, 11, 22, '2d21d5bade351ebccd62c561583771b62777a6d3fa16a8a12f7b5c31a3578df8', '2026-11-15 21:03:38.764', NULL, '2026-10-16 21:03:38.765'),
(351, 11, 22, 'bd238dba9127959cf09ae897f14a816b3b231673d5f7a4db17e830c4f9d7c467', '2026-11-15 21:25:22.817', '2026-10-16 21:27:28.077', '2026-10-16 21:25:22.818'),
(352, 8, 19, '150edae4f8246c34f3a75550e8e782a81c6a12bc0bf5d2a14cdec04b8713adae', '2026-11-15 21:26:50.698', NULL, '2026-10-16 21:26:50.700'),
(353, 8, 19, '7872724a198583200457b1913edd0d92a73ff3423836cf7adc10dd095f5f90b6', '2026-11-15 21:26:50.925', '2026-10-16 21:27:13.293', '2026-10-16 21:26:50.928'),
(354, 8, 19, '533ab75cf9df9a953d021f4adc9bfae6b92fba478d1693655ed7bfb2414b7148', '2026-11-15 21:27:13.333', NULL, '2026-10-16 21:27:13.334'),
(355, 8, 19, 'b264afb8b9818c18d4912a7a0cf75437b468699c3558a0a69e0f39d1287e8af2', '2026-11-15 21:27:13.772', '2026-10-16 21:27:47.020', '2026-10-16 21:27:13.773'),
(356, 11, 22, 'af6500bb0da0d8b7ac0d8b3593d366ee7529288fda18c2150a832fa19cc2fefe', '2026-11-15 21:27:28.091', '2026-10-16 21:42:28.524', '2026-10-16 21:27:28.091'),
(357, 8, 19, '12f065ca612cf3e0acb59a0ff1f4b8238d020677ecb22c5385079e1bac885b17', '2026-11-15 21:27:47.350', NULL, '2026-10-16 21:27:47.352'),
(358, 8, 19, 'dd9a3f68898b58795c60eff261011929a0822f778c20d421af778f83cf915080', '2026-11-15 21:27:47.508', NULL, '2026-10-16 21:27:47.509'),
(359, 11, 22, '6532fcfbe2412a8c4cd82ed965872eced48e4c7c7f3f92c13feaa3c43213c4cb', '2026-11-15 21:42:28.537', NULL, '2026-10-16 21:42:28.538'),
(360, 11, 22, '7ebd9393d133ba11a44241fd9a44a1589151f6ad8ec2a4039e8c4902190d9507', '2026-11-15 21:47:32.920', '2026-10-16 21:51:09.296', '2026-10-16 21:47:32.920'),
(361, 8, 21, 'c7751e725ee246104ffb1982540cf4710406d14ee2fbc019f56735b74edf2ebe', '2026-11-15 21:51:24.345', '2026-10-19 20:31:39.959', '2026-10-16 21:51:24.346'),
(362, 8, 21, '8086c7221bcbf1c3f1a3398b2234c48816e6fd11aa1560907d0e6b7014ffc5bd', '2026-11-18 20:31:39.958', '2026-10-21 07:31:38.232', '2026-10-19 20:31:39.960'),
(363, 8, 21, '6566efca95b25cd3873295e0f12d0b9c1374ca6e7d87279242a04ac89385c38b', '2026-11-18 20:31:39.964', NULL, '2026-10-19 20:31:39.965'),
(364, 1, 12, '92b37edd12e96b1909ed56d721d6d695b55ec47b086bbf2f4afa4eaaefea608f', '2026-11-20 07:24:01.216', '2026-10-22 19:31:00.570', '2026-10-21 07:24:01.219'),
(365, 14, 25, 'd05f26dd213b96c4fb7e29df3630b5525129d7c4e25dde73a8cf7abd37c40095', '2026-11-20 07:27:51.946', '2026-10-21 07:43:45.826', '2026-10-21 07:27:51.947'),
(366, 8, 21, '100585b46d92f43601edb6c453fccbdb8062f90830c8df6bb1171999095f6c94', '2026-11-20 07:31:38.228', NULL, '2026-10-21 07:31:38.229'),
(367, 8, 21, '9a47c78b41619bb93f763eacc8ccd07fefa6bb3b82974feeecf7b6adc19ac0ff', '2026-11-20 07:31:38.235', '2026-10-21 07:31:41.777', '2026-10-21 07:31:38.236'),
(368, 15, 26, '31710483f604f4e1352c0f0508f5271d627684c192f1fa0104394529273f38d6', '2026-11-20 07:32:11.495', '2026-10-24 07:06:48.953', '2026-10-21 07:32:11.495'),
(369, 14, 25, '8e42a62f6f600852fa31412d89c2a1fe3c75b4564759bbf9008957e53a7e57fd', '2026-11-20 07:43:45.841', '2026-10-21 07:46:45.557', '2026-10-21 07:43:45.842'),
(370, 8, 19, '77d79ad652ae712540905fef25dda8558c04b692e753ce2f6434153ff52241e0', '2026-11-21 06:28:13.873', '2026-10-22 06:30:35.495', '2026-10-22 06:28:13.875'),
(371, 1, 12, 'acbade04b11c0dd89465a409cfc3d19f0ad9eae563fe59835f88488e6e38338f', '2026-11-21 06:31:27.321', '2026-10-22 06:31:30.709', '2026-10-22 06:31:27.322'),
(372, 1, 12, '287e5da2410af1f2ad874804d334f232a9b2ddcd66493713c2e00f1af3cd8e7b', '2026-11-21 06:31:30.723', '2026-10-22 06:32:30.427', '2026-10-22 06:31:30.724'),
(373, 1, 12, '38e79e7625e1a8d7675e87fd0a91e1214bf04ed402dd6d36ba9717d3dab76b66', '2026-11-21 06:32:30.442', NULL, '2026-10-22 06:32:30.443'),
(374, 17, 27, '34d828f233177d9c1752ac4108df4b802cf04d4675fc9c28015b6bdc5da172bc', '2026-11-21 06:33:02.949', NULL, '2026-10-22 06:33:02.950'),
(375, 17, 27, '9dcf78606308c92ccd4d4ba1472d99ec4cc0700956bcf5e1fb4ffc3b71dcd1f3', '2026-11-21 06:33:39.556', NULL, '2026-10-22 06:33:39.557'),
(376, 11, 22, '641604a2c0eba084e8ea2bfb0fc1bcc066fa952b6f00e835a459113b38149161', '2026-11-21 19:08:18.291', '2026-10-22 19:23:18.631', '2026-10-22 19:08:18.293'),
(377, 11, 22, '77dfad04b71a6e80dd36702ea91bc4104b0e6be3aac1d8c103b6269c19d9ddb8', '2026-11-21 19:23:18.635', '2026-10-22 19:23:19.081', '2026-10-22 19:23:18.636'),
(378, 11, 22, 'c2475fa493be0ea95b52b3250c617c5ae23d0233b58f211b2aa6f735e79ed08a', '2026-11-21 19:23:19.084', '2026-10-22 19:36:38.689', '2026-10-22 19:23:19.084'),
(379, 1, 12, 'c1f5c764939abd867f63c72e41e8f2c9a041f20b4bacfd6f53469c88b532fc67', '2026-11-21 19:31:00.576', '2026-10-22 19:31:18.872', '2026-10-22 19:31:00.577'),
(380, 8, 19, '10d9ccdb3d0a3abdb68a15f6fa599b8704f1e74cecb06e2649ff12f9fc61fbb1', '2026-11-21 19:31:38.526', '2026-10-23 13:42:19.672', '2026-10-22 19:31:38.527'),
(381, 11, 22, '2b2ebd7f9e7b0b6f6b03c3b369a25e64bf5da581227d507c5e5a226f238064cd', '2026-11-21 19:36:38.693', '2026-10-22 19:38:41.505', '2026-10-22 19:36:38.693'),
(382, 11, 22, 'cfd07d5cc169c861b16dcffde10f85f5e31774eb72fb5127e5f7c94625720778', '2026-11-21 19:38:41.509', '2026-10-22 19:38:51.118', '2026-10-22 19:38:41.510'),
(383, 11, 22, '6f377cdaa9354896705f7d8d7d1b2f8332fadcc52f68b86ea9f9b95b7eb08e5d', '2026-11-21 19:38:51.125', '2026-10-22 19:39:07.405', '2026-10-22 19:38:51.126'),
(384, 11, 22, 'a01c9f6f630a9a35a7708820226550590822a554da69cf4d9c25d8d366b019ce', '2026-11-21 19:39:07.419', '2026-10-22 20:13:19.820', '2026-10-22 19:39:07.420'),
(385, 11, 22, 'cc5cecb171091126a53fcd320f3a85c7455befef3fe6c50b0aefaff2022323c5', '2026-11-21 20:13:19.835', NULL, '2026-10-22 20:13:19.836'),
(386, 11, 22, '2449eff7cf3fd73950fdebd07a7d4657b2f96f0bbfe889722e780d94f1c45a78', '2026-11-21 20:13:19.840', '2026-10-22 20:14:04.179', '2026-10-22 20:13:19.841'),
(387, 11, 22, '6b5d1c0db24d1c2bb464b8d03a61dfea8276de41c392786388096bbbf770aa59', '2026-11-21 20:14:04.184', '2026-10-22 20:18:11.883', '2026-10-22 20:14:04.185'),
(388, 11, 22, '03d197a99d6c72e1346fc5d071184168b3d9ecdbcbfe87df2b3f7ad9f5eeb77c', '2026-11-21 20:18:11.887', '2026-10-22 20:31:12.298', '2026-10-22 20:18:11.888'),
(389, 11, 22, 'e0f67bc8548f92a57a88a76e9add7497681a186142154fba898bf8e8c4ada4ea', '2026-11-21 20:31:12.313', '2026-10-22 20:46:24.094', '2026-10-22 20:31:12.314'),
(390, 11, 22, '1459c761cc1c0008c77cf6cff9a3497507068806d5d5010f64a3135be626a194', '2026-11-21 20:46:24.099', '2026-10-22 21:01:24.181', '2026-10-22 20:46:24.100'),
(391, 11, 22, '874451ac3a9f07ebc174a1b098984db232d0937d4433e7f17f54e620e7dcf066', '2026-11-21 21:01:24.195', '2026-10-23 02:20:06.263', '2026-10-22 21:01:24.196'),
(392, 11, 22, '72239b77d443c34505fad5125ea78ad5e746f28a81228d9e4ebdf1f7d5dfc332', '2026-11-22 02:20:06.302', '2026-10-23 02:35:15.478', '2026-10-23 02:20:06.305'),
(393, 11, 22, 'daf83f8c4a02387385ec5c2b9311d6aed277929d15d968c52e2741eae5fb3db8', '2026-11-22 02:35:15.493', '2026-10-23 02:50:15.545', '2026-10-23 02:35:15.494'),
(394, 11, 22, '7c11e789bf5322198c1de6e4263243f49ca0c15948d02a9bbe8390a8eb02e483', '2026-11-22 02:50:15.559', '2026-10-23 03:05:15.453', '2026-10-23 02:50:15.560'),
(395, 11, 22, '45cdbd8acf671acd135c555d3c3fc0b3fb6536a54ec907f556c3101249933986', '2026-11-22 03:05:15.468', '2026-10-23 03:20:15.772', '2026-10-23 03:05:15.469'),
(396, 11, 22, 'eb06df33ee6e8a60721a973251030032d4b073acfceb220cfd0d37d6e116982d', '2026-11-22 03:20:15.776', '2026-10-23 03:35:15.458', '2026-10-23 03:20:15.777'),
(397, 11, 22, 'f61008c828e75cbd08f2155a3cede84fc0762baa88f049aad5e5f0ac464ccbbb', '2026-11-22 03:35:15.462', '2026-10-23 03:50:15.654', '2026-10-23 03:35:15.463'),
(398, 11, 22, '130aa30e881b4c358843d09128f97b6986f99974bdede6d04075bd5db1bbbd66', '2026-11-22 03:50:15.658', NULL, '2026-10-23 03:50:15.659'),
(399, 1, 12, '02e136b3dec55ec62f7898daca9b445448415be523fa7d9904c3b7b606a2e1b9', '2026-11-22 11:18:14.713', '2026-10-23 11:19:41.582', '2026-10-23 11:18:14.715'),
(400, 1, 12, '24dda977e71f3a38056b63a9866a57b88bbf37e985204b8782511514cded876c', '2026-11-22 11:19:41.598', NULL, '2026-10-23 11:19:41.599'),
(401, 18, 28, '164fe2ceff089417c54aed415c03817dca867a451de814b13d84519e4b8a5866', '2026-11-22 11:20:19.882', '2026-10-23 11:39:28.058', '2026-10-23 11:20:19.883'),
(402, 18, 28, '6ec741c860524f6d0235213c34bf64e182de916a7f6b38e75f0c4d3cc082db6a', '2026-11-22 11:39:28.064', '2026-10-23 12:08:59.297', '2026-10-23 11:39:28.065'),
(403, 20, 29, '20888b299e9a116d4ec8d69b8892af74c8cb3dd1d7929fd9c4a07708d4f562fe', '2026-11-22 11:41:05.609', NULL, '2026-10-23 11:41:05.610'),
(404, 20, 29, 'ed94336ad8838717efbc2d247a8667e0de91a411a7e7e622cfd7058f0ddb7453', '2026-11-22 11:43:10.711', '2026-10-23 11:44:33.712', '2026-10-23 11:43:10.711'),
(405, 20, 29, '4e65b0b9605a799e1ba219e43fc2dc814272dcffe25ee9ec33666896366b41ce', '2026-11-22 11:44:33.728', '2026-10-23 11:44:58.180', '2026-10-23 11:44:33.729'),
(406, 20, 29, '214571b52109fc46a38766d076380acc5b11909244380e21b02908859b720800', '2026-11-22 11:44:58.196', '2026-10-23 11:46:24.430', '2026-10-23 11:44:58.197'),
(407, 20, 29, '90c34d1321d27a0145c8e12f0b011c6dbc36b303345a28c0b633b63947c68199', '2026-11-22 11:46:24.445', '2026-10-23 11:47:12.646', '2026-10-23 11:46:24.446'),
(408, 20, 29, '3e990ea10b59e141d555bdbe93b82391ed13bee5e712adbd11fc30d4101fc0dc', '2026-11-22 11:47:12.661', '2026-10-23 12:02:46.180', '2026-10-23 11:47:12.662'),
(409, 20, 29, '5d931274bb2c7544fd389a9c86b9fb4079f3957bb589e4ea2077acff722559da', '2026-11-22 12:02:46.195', '2026-10-23 12:10:27.785', '2026-10-23 12:02:46.196'),
(410, 18, 28, 'b81f8d1f2f09e979a6036eaeb5cfcf454a300db515bbf1303d321dce0519bb9a', '2026-11-22 12:08:59.312', '2026-10-23 13:38:17.881', '2026-10-23 12:08:59.313'),
(411, 20, 29, '01fcc9eb5df7f395eb05d7c9e8ba5444e84005f12c85bee3a56a2978884b1d78', '2026-11-22 12:10:27.801', '2026-10-23 12:25:46.079', '2026-10-23 12:10:27.802'),
(412, 20, 29, '8d7d537cfe8852d47176f4cd08cc4cf2a2b666be7bb43a8a08e2113962a0b294', '2026-11-22 12:25:46.083', '2026-10-23 12:40:46.138', '2026-10-23 12:25:46.084'),
(413, 20, 29, 'b1db1a657124db3d36a2be9205df0fb07763079576ed939c736763419ac400f5', '2026-11-22 12:40:46.154', '2026-10-23 12:55:46.099', '2026-10-23 12:40:46.155'),
(414, 20, 29, '191984ae7e6b1f4ea72141078744cb94b471aed2a3b38da8bd2956b82f2cb777', '2026-11-22 12:55:46.104', '2026-10-23 13:10:46.107', '2026-10-23 12:55:46.105'),
(415, 20, 29, '942321ffa3469e5ccfe50470816ab21dd2416c1ed914a054998fbdb74c6e0a56', '2026-11-22 13:10:46.123', '2026-10-23 13:25:46.560', '2026-10-23 13:10:46.124'),
(416, 20, 29, 'ddedcf66582c4f6f6a22b7ce1a70639de2367df4ed9432503c396864cc989a04', '2026-11-22 13:25:46.565', '2026-10-23 13:40:46.114', '2026-10-23 13:25:46.566'),
(417, 18, 28, '4c4618ca6c76429a5c96a5e61b1b16e5fa61aaf6a41b11d905035aa78484d378', '2026-11-22 13:38:17.886', '2026-10-23 13:38:34.238', '2026-10-23 13:38:17.887'),
(418, 18, 28, '5842aaddc79a2bcc789ddc453846c5604f08a58c5e71ca54e8bd3617e0e11b8a', '2026-11-22 13:38:34.253', '2026-10-23 13:38:47.961', '2026-10-23 13:38:34.254'),
(419, 18, 28, '92f548480eedd6f3963dedf43216bed664f4f2422b761b2f4d4b8aa6edf5c1f3', '2026-11-22 13:39:28.027', NULL, '2026-10-23 13:39:28.028'),
(420, 20, 29, '9cab687ef25be7370e2a2f056944370d90e663e8341da34b024fdbb4b382da48', '2026-11-22 13:40:46.129', NULL, '2026-10-23 13:40:46.130'),
(421, 8, 19, '9df1078af0eb49ca2d628f5df5fbb4fff5aa6acc34f1b29c6bf20588b754d496', '2026-11-22 13:42:19.689', '2026-10-23 13:43:46.716', '2026-10-23 13:42:19.689'),
(422, 18, 28, '19a482da33168d5aacf6aed419952a46b522ddbe262fa76fb3f634eb79505550', '2026-11-23 06:54:54.668', '2026-10-24 06:56:09.689', '2026-10-24 06:54:54.670'),
(423, 8, 19, 'db367d572d3c401192050aa5d8dc0a73dc46d32389b6b28d67adc5298f3ccd25', '2026-11-23 06:56:34.667', '2026-10-24 07:07:42.262', '2026-10-24 06:56:34.668'),
(424, 15, 26, 'da21bf9ca911b2f842addfcd54d2240310fb5cdccf3d6b15d337664bb778657c', '2026-11-23 07:06:48.943', '2026-10-24 07:06:53.054', '2026-10-24 07:06:48.943'),
(425, 15, 26, 'dd4e30a843d14038d7a30bddf152d1600b3c3414ba6da272c6b19298fe0e1e0a', '2026-11-23 07:06:48.965', NULL, '2026-10-24 07:06:48.966'),
(426, 11, 22, '876d105e5fdcfed5493468721aec6585c4c2b9be23a8a34c268e5c33a9ee9398', '2026-11-23 07:07:14.510', NULL, '2026-10-24 07:07:14.511'),
(427, 8, 19, '68aaf5b163f21288e049cb5e296f6e1946320ec31553a2c0b6be4a14342548b2', '2026-11-23 07:07:42.276', '2026-10-24 07:18:18.527', '2026-10-24 07:07:42.277'),
(428, 1, 12, '962c67384df7e3ed9274836ca2e950adfe8d49d9258a35d6fc5cbf9fe5154e22', '2026-11-23 07:18:31.308', '2026-10-24 07:19:12.534', '2026-10-24 07:18:31.309');

-- --------------------------------------------------------

--
-- Table structure for table `role`
--

CREATE TABLE `role` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `code` enum('ADMIN','MANAGER','SALES_EXECUTIVE') NOT NULL,
  `name` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role`
--

INSERT INTO `role` (`id`, `tenantId`, `code`, `name`, `createdAt`) VALUES
(1, 1, 'ADMIN', 'Admin', '2026-09-24 08:19:46.241'),
(2, 1, 'MANAGER', 'Manager', '2026-09-24 08:19:46.251'),
(3, 1, 'SALES_EXECUTIVE', 'Sales Executive', '2026-09-24 08:19:46.260'),
(10, 4, 'ADMIN', 'Admin', '2026-10-12 17:10:34.481'),
(11, 4, 'SALES_EXECUTIVE', 'Sales Executive', '2026-10-12 17:10:34.481'),
(12, 4, 'MANAGER', 'Manager', '2026-10-12 17:10:34.481'),
(13, 5, 'ADMIN', 'Admin', '2026-10-13 01:41:33.328'),
(14, 5, 'MANAGER', 'Manager', '2026-10-13 01:41:33.329'),
(15, 5, 'SALES_EXECUTIVE', 'Sales Executive', '2026-10-13 01:41:33.330'),
(16, 6, 'MANAGER', 'Manager', '2026-10-21 07:27:32.480'),
(17, 6, 'ADMIN', 'Admin', '2026-10-21 07:27:32.480'),
(18, 6, 'SALES_EXECUTIVE', 'Sales Executive', '2026-10-21 07:27:32.481'),
(19, 7, 'SALES_EXECUTIVE', 'Sales Executive', '2026-10-22 06:32:28.764'),
(20, 7, 'ADMIN', 'Admin', '2026-10-22 06:32:28.764'),
(21, 7, 'MANAGER', 'Manager', '2026-10-22 06:32:28.764'),
(22, 8, 'ADMIN', 'Admin', '2026-10-23 11:19:36.610'),
(23, 8, 'SALES_EXECUTIVE', 'Sales Executive', '2026-10-23 11:19:36.610'),
(24, 8, 'MANAGER', 'Manager', '2026-10-23 11:19:36.611');

-- --------------------------------------------------------

--
-- Table structure for table `sale`
--

CREATE TABLE `sale` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `customerId` int(11) DEFAULT NULL,
  `leadId` int(11) DEFAULT NULL,
  `visitId` int(11) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `collectionAmount` decimal(12,2) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `billPhotoPath` varchar(191) DEFAULT NULL,
  `clientRequestId` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sale`
--

INSERT INTO `sale` (`id`, `tenantId`, `userId`, `customerId`, `leadId`, `visitId`, `amount`, `collectionAmount`, `note`, `billPhotoPath`, `clientRequestId`, `createdAt`, `updatedAt`) VALUES
(1, 1, 3, NULL, 1, 3, 2500.00, NULL, 'First order', NULL, 'visit:3', '2026-09-24 09:36:37.139', '2026-09-24 09:36:37.139'),
(2, 1, 3, NULL, 9, 4, 100.00, NULL, NULL, 'F:\\Sales Project\\backend\\uploads\\sales\\2-1790253708610.jpg', 'visit:4', '2026-09-24 12:41:28.646', '2026-09-24 12:41:48.630'),
(3, 4, 11, NULL, 14, 7, 2000.00, NULL, NULL, NULL, 'visit:7', '2026-10-13 10:13:20.571', '2026-10-13 10:13:20.571'),
(4, 4, 11, NULL, 14, 8, 2000.00, NULL, 'Thanks', NULL, 'visit:8', '2026-10-13 10:26:51.392', '2026-10-13 10:26:51.392'),
(5, 4, 11, NULL, 19, 9, 5000.00, NULL, NULL, '/var/www/Sales-tracking/backend/uploads/sales/5-1791888144442.jpg', 'visit:9', '2026-10-13 10:42:09.269', '2026-10-13 10:42:24.658'),
(6, 4, 11, NULL, 15, 10, 10000.00, NULL, NULL, '/var/www/Sales-tracking/backend/uploads/sales/6-1791892995779.jpg', 'visit:10', '2026-10-13 12:03:06.657', '2026-10-13 12:03:15.786'),
(7, 4, 13, NULL, 21, 12, 500.00, NULL, NULL, '/var/www/Sales-tracking/backend/uploads/sales/7-1791917639492.jpg', 'visit:12', '2026-10-13 18:53:55.587', '2026-10-13 18:53:59.503'),
(8, 6, 15, NULL, 22, 14, 5000.00, NULL, NULL, '/var/www/Sales-tracking/backend/uploads/sales/8-1792568605259.jpg', 'visit:14', '2026-10-21 07:43:24.908', '2026-10-21 07:43:25.264'),
(9, 4, 11, NULL, 16, 16, 100.00, NULL, NULL, NULL, 'visit:16', '2026-10-24 07:11:08.557', '2026-10-24 07:11:08.557');

-- --------------------------------------------------------

--
-- Table structure for table `team`
--

CREATE TABLE `team` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `team`
--

INSERT INTO `team` (`id`, `tenantId`, `name`, `createdAt`, `updatedAt`) VALUES
(1, 1, 'Field Team', '2026-09-24 08:19:46.271', '2026-09-24 08:19:46.271');

-- --------------------------------------------------------

--
-- Table structure for table `teammember`
--

CREATE TABLE `teammember` (
  `teamId` int(11) NOT NULL,
  `userId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `teammember`
--

INSERT INTO `teammember` (`teamId`, `userId`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 7);

-- --------------------------------------------------------

--
-- Table structure for table `tenant`
--

CREATE TABLE `tenant` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tenant`
--

INSERT INTO `tenant` (`id`, `name`, `slug`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'Demo Company', 'demo-company', 'active', '2026-09-24 08:19:46.212', '2026-09-24 08:19:46.212'),
(4, 'Sepcune technology', 'sepcune-technology', 'active', '2026-10-12 17:10:34.460', '2026-10-12 17:58:57.839'),
(5, 'Kamax beauty', 'kamax-beauty', 'active', '2026-10-13 01:41:33.316', '2026-10-15 13:05:40.960'),
(6, 'zoom', 'zoom', 'active', '2026-10-21 07:27:32.462', '2026-10-21 07:27:47.457'),
(7, 'kamax beauty pvt ltd', 'kamax-beauty-pvt-ltd', 'active', '2026-10-22 06:32:28.747', '2026-10-22 06:32:36.849'),
(8, 'dingding', 'dingding', 'active', '2026-10-23 11:19:36.585', '2026-10-23 11:19:57.036');

-- --------------------------------------------------------

--
-- Table structure for table `tenantsettings`
--

CREATE TABLE `tenantsettings` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `liveLocationEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `visitCheckinRadiusMeters` int(11) NOT NULL DEFAULT 100,
  `trackingIntervalSeconds` int(11) NOT NULL DEFAULT 300,
  `trackingSignificantMovementMeters` int(11) NOT NULL DEFAULT 100,
  `timezone` varchar(191) NOT NULL DEFAULT 'Asia/Kolkata',
  `workStart` varchar(191) NOT NULL DEFAULT '09:00',
  `workEnd` varchar(191) NOT NULL DEFAULT '19:00',
  `locationRawRetentionDays` int(11) NOT NULL DEFAULT 90,
  `allowDuplicateLeads` tinyint(1) NOT NULL DEFAULT 0,
  `autoCloseFieldSessionHours` int(11) NOT NULL DEFAULT 12,
  `allowUnverifiedCheckin` tinyint(1) NOT NULL DEFAULT 0,
  `currency` varchar(191) NOT NULL DEFAULT 'INR',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tenantsettings`
--

INSERT INTO `tenantsettings` (`id`, `tenantId`, `liveLocationEnabled`, `visitCheckinRadiusMeters`, `trackingIntervalSeconds`, `trackingSignificantMovementMeters`, `timezone`, `workStart`, `workEnd`, `locationRawRetentionDays`, `allowDuplicateLeads`, `autoCloseFieldSessionHours`, `allowUnverifiedCheckin`, `currency`, `createdAt`, `updatedAt`) VALUES
(1, 1, 1, 100, 300, 100, 'Asia/Kolkata', '09:00', '19:00', 90, 0, 12, 0, 'INR', '2026-09-24 08:19:46.212', '2026-09-26 11:30:46.085'),
(4, 4, 1, 100, 300, 100, 'Asia/Kolkata', '09:00', '19:00', 90, 0, 12, 0, 'INR', '2026-10-12 17:10:34.460', '2026-10-24 07:07:49.754'),
(5, 5, 0, 100, 300, 100, 'Asia/Kolkata', '09:00', '19:00', 90, 0, 12, 0, 'INR', '2026-10-13 01:41:33.316', '2026-10-13 01:41:33.316'),
(6, 6, 0, 100, 300, 100, 'Asia/Kolkata', '09:00', '19:00', 90, 0, 12, 0, 'INR', '2026-10-21 07:27:32.462', '2026-10-21 07:45:32.252'),
(7, 7, 1, 100, 300, 100, 'Asia/Kolkata', '09:00', '19:00', 90, 0, 12, 0, 'INR', '2026-10-22 06:32:28.747', '2026-10-22 06:38:02.312'),
(8, 8, 1, 100, 300, 100, 'Asia/Kolkata', '09:00', '19:00', 90, 0, 12, 0, 'INR', '2026-10-23 11:19:36.585', '2026-10-23 12:09:06.488');

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `passwordHash` varchar(191) NOT NULL,
  `status` enum('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `platformAdmin` tinyint(1) NOT NULL DEFAULT 0,
  `employeeId` varchar(40) DEFAULT NULL,
  `designation` varchar(80) DEFAULT NULL,
  `city` varchar(80) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `joiningDate` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user`
--

INSERT INTO `user` (`id`, `tenantId`, `name`, `phone`, `email`, `passwordHash`, `status`, `createdAt`, `updatedAt`, `platformAdmin`, `employeeId`, `designation`, `city`, `address`, `joiningDate`) VALUES
(1, 1, 'Admin User', '9084429530', 'lk.kushwah303@gmail.com', '$2b$10$Hei8MJn8E4MlfGRImtJ9Qug7l9BpM9VSizDkiirVQwyyKPRrOZU..', 'ACTIVE', '2026-09-24 08:19:46.279', '2026-10-16 20:42:40.020', 1, NULL, NULL, NULL, NULL, NULL),
(2, 1, 'Manager User', '7777777777', NULL, '$2b$10$cjcRZwQQNQps.DWPrtBBq.sRUnq4ghIL.KP/e.NqVCmlf3T5RYvb6', 'ACTIVE', '2026-09-24 08:19:46.311', '2026-09-24 12:13:51.279', 0, NULL, NULL, NULL, NULL, NULL),
(3, 1, 'Rahul Kumar', '8888888888', NULL, '$2b$10$cjcRZwQQNQps.DWPrtBBq.sRUnq4ghIL.KP/e.NqVCmlf3T5RYvb6', 'ACTIVE', '2026-09-24 08:19:46.341', '2026-09-24 12:13:51.329', 0, NULL, NULL, NULL, NULL, NULL),
(7, 1, 'Priya Sharma', '6666666666', NULL, '$2b$10$cjcRZwQQNQps.DWPrtBBq.sRUnq4ghIL.KP/e.NqVCmlf3T5RYvb6', 'ACTIVE', '2026-09-24 12:13:51.363', '2026-09-24 12:13:51.363', 0, NULL, NULL, NULL, NULL, NULL),
(8, 4, 'LOKENDRA KUSHWAH', '9084429531', NULL, '$2b$10$QylTxaSR8fTLSM4i899n7OEuM8jE3e.996SmHgs0NTXicOjGkwpOK', 'ACTIVE', '2026-10-12 17:10:34.576', '2026-10-23 13:42:32.258', 0, NULL, NULL, NULL, NULL, NULL),
(9, 4, 'lokendra', '1234567890', NULL, '$2b$10$NJdqEvwAs0pfs1cBxdFptu1Xu0akN./UQztkr73LMymyKnefWDx1C', 'ACTIVE', '2026-10-12 20:01:19.069', '2026-10-12 20:01:19.069', 0, NULL, NULL, NULL, NULL, NULL),
(10, 5, 'Sonia panwar', '9910526875', NULL, '$2b$10$7s8A3Uvn.zJR3llKRNlIfuGgXm4Api55vAMtLhMf1c6FNKSDwRf1K', 'ACTIVE', '2026-10-13 01:41:33.456', '2026-10-15 13:05:41.204', 0, NULL, NULL, NULL, NULL, NULL),
(11, 4, 'Aman', '9667280111', NULL, '$2b$10$ptK74lQaQVJI4kOfpvOWEub9oe1jYIlgvyUMT0EprZrdy0ULuxHqW', 'ACTIVE', '2026-10-13 08:43:43.913', '2026-10-13 08:43:43.913', 0, NULL, NULL, NULL, NULL, NULL),
(12, 4, 'Punit ', '9999999999', NULL, '$2b$10$eAAF.dA53SUfzyoNLG8hdelwoxGNECL.m.r8i42yO7sENP7LbF4zq', 'ACTIVE', '2026-10-13 18:44:24.910', '2026-10-13 18:44:24.910', 0, NULL, NULL, NULL, NULL, NULL),
(13, 4, 'Puneet', '1112223334', NULL, '$2b$10$fH1V5A91Bh8R2WJ9meWbTegHbDFXTtTs.fFViwEIF3SXTMvgc2OBK', 'ACTIVE', '2026-10-13 18:47:46.395', '2026-10-13 18:47:46.395', 0, NULL, NULL, NULL, NULL, NULL),
(14, 6, 'Test', '1234567892', 'mayankrawat137@gmail.com', '$2b$10$dv67YPGO0K565AJ6ta8kRuO4PTXuPCY2LE3tF6BanvPAT8/J9WXPi', 'ACTIVE', '2026-10-21 07:27:32.578', '2026-10-21 07:27:47.476', 0, NULL, NULL, NULL, NULL, NULL),
(15, 6, 'lokendra', '1414771490', 'lokendra@gmail.com', '$2b$10$.TRyC63NBLOhWH32ag0Ngu/UcksbDb/rkcwbbh6c2Hiu29tku0n7S', 'ACTIVE', '2026-10-21 07:30:06.167', '2026-10-21 07:30:06.167', 0, '420', 'waiter', 'bihar', NULL, NULL),
(16, 6, 'Dev', '1714771490', 'devji@gmail.com', '$2b$10$CdTPw9T5qHlbAJ3K4SSOXec2w9MdDCn0eswZZKuEPbOhKqd76qB5m', 'ACTIVE', '2026-10-21 07:31:18.492', '2026-10-21 07:31:18.492', 0, '321', 'ceo', 'delhi', NULL, NULL),
(17, 7, 'Ajay Singh', '9560206551', 'info@kamaxbeauty.com', '$2b$10$cwKO/QLyA3gHwnE2BIHNreEfK/pLzmKdIuK7co30xwGBWsDHdZNP.', 'ACTIVE', '2026-10-22 06:32:28.847', '2026-10-22 06:32:36.865', 0, NULL, NULL, NULL, NULL, NULL),
(18, 8, 'Mayank Rawat', '1234567898', 'rawatmayank691@gmail.com', '$2b$10$RPleBesL9Kl.WROGhXU48eaVVR3Lpx3o4xE9i8xYDP2mA.l6u/ZkS', 'ACTIVE', '2026-10-23 11:19:36.719', '2026-10-23 11:20:41.610', 0, NULL, NULL, NULL, NULL, NULL),
(19, 8, 'Lokendra', '1234567890', 'lk.kushwah@gmail.com', '$2b$10$7ozcJK2i4KMKPt3dob30F.u9PLwxPnWA9tF2fLSkT.SX8rDiu4sCq', 'ACTIVE', '2026-10-23 11:22:55.482', '2026-10-23 11:22:55.482', 0, '420', 'waiter', 'noida', NULL, NULL),
(20, 8, 'hello', '0987654321', 'lk@gmail.com', '$2b$10$fPs.9ffcZwdHPgsvS1rREONtpt/MB1HpXf0PtpL6CBH3EVdbtGokC', 'ACTIVE', '2026-10-23 11:40:24.208', '2026-10-23 11:40:24.208', 0, '60', 'chor', 'agra', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `userrole`
--

CREATE TABLE `userrole` (
  `userId` int(11) NOT NULL,
  `roleId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `userrole`
--

INSERT INTO `userrole` (`userId`, `roleId`) VALUES
(1, 1),
(2, 2),
(3, 3),
(7, 3),
(9, 11),
(11, 11),
(12, 11),
(13, 11),
(8, 12),
(10, 14),
(14, 16),
(15, 18),
(16, 18),
(17, 21),
(19, 23),
(20, 23),
(18, 24);

-- --------------------------------------------------------

--
-- Table structure for table `visit`
--

CREATE TABLE `visit` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `leadId` int(11) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `beatStopId` int(11) DEFAULT NULL,
  `status` enum('IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
  `outcome` enum('SUCCESS','UNAVAILABLE') DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `checkedInAt` datetime(3) NOT NULL,
  `checkedOutAt` datetime(3) DEFAULT NULL,
  `checkinLat` decimal(10,7) NOT NULL,
  `checkinLng` decimal(10,7) NOT NULL,
  `checkinAccuracy` decimal(8,2) DEFAULT NULL,
  `distanceMeters` int(11) DEFAULT NULL,
  `verified` tinyint(1) NOT NULL DEFAULT 0,
  `photoPath` varchar(191) DEFAULT NULL,
  `photoLat` decimal(10,7) DEFAULT NULL,
  `photoLng` decimal(10,7) DEFAULT NULL,
  `photoAccuracy` decimal(8,2) DEFAULT NULL,
  `photoCapturedAt` datetime(3) DEFAULT NULL,
  `photoReceivedAt` datetime(3) DEFAULT NULL,
  `managerConfirmedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `collectionAmount` decimal(12,2) DEFAULT NULL,
  `saleAmount` decimal(12,2) DEFAULT NULL,
  `checkinDistanceMeters` int(11) DEFAULT NULL,
  `checkoutLat` decimal(10,7) DEFAULT NULL,
  `checkoutLng` decimal(10,7) DEFAULT NULL,
  `checkoutAccuracy` decimal(8,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `visit`
--

INSERT INTO `visit` (`id`, `tenantId`, `userId`, `leadId`, `customerId`, `beatStopId`, `status`, `outcome`, `notes`, `checkedInAt`, `checkedOutAt`, `checkinLat`, `checkinLng`, `checkinAccuracy`, `distanceMeters`, `verified`, `photoPath`, `photoLat`, `photoLng`, `photoAccuracy`, `photoCapturedAt`, `photoReceivedAt`, `managerConfirmedAt`, `createdAt`, `updatedAt`, `collectionAmount`, `saleAmount`, `checkinDistanceMeters`, `checkoutLat`, `checkoutLng`, `checkoutAccuracy`) VALUES
(1, 1, 3, 1, NULL, NULL, 'COMPLETED', 'SUCCESS', 'Met owner', '2026-09-24 08:59:37.544', '2026-09-24 08:59:38.071', 28.6328000, 77.2197000, 8.00, 0, 1, 'F:\\Sales Project\\api\\uploads\\visits\\1-1790240377987.jpg', 28.6328000, 77.2197000, NULL, '2026-09-24 08:59:37.640', '2026-09-24 08:59:38.005', '2026-09-26 10:20:20.927', '2026-09-24 08:59:37.547', '2026-09-26 10:20:20.929', NULL, NULL, NULL, NULL, NULL, NULL),
(2, 1, 3, 2, NULL, NULL, 'COMPLETED', 'UNAVAILABLE', 'Shop closed', '2026-09-24 08:59:38.123', '2026-09-24 08:59:38.165', 28.5708000, 77.3261000, NULL, 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-24 08:59:38.125', '2026-09-24 08:59:38.167', NULL, NULL, NULL, NULL, NULL, NULL),
(3, 1, 3, 1, NULL, 1, 'COMPLETED', 'SUCCESS', 'Sprint 6 proof', '2026-09-24 09:36:21.851', '2026-09-24 09:36:37.076', 28.6328000, 77.2197000, NULL, 0, 1, 'F:\\Sales Project\\backend\\uploads\\visits\\3-1790242597011.jpg', 28.6328000, 77.2197000, NULL, '2026-09-24 09:36:37.032', '2026-09-24 09:36:37.032', '2026-09-24 09:36:37.204', '2026-09-24 09:36:21.853', '2026-09-24 09:36:37.207', NULL, 2500.00, NULL, NULL, NULL, NULL),
(4, 1, 3, 9, NULL, NULL, 'COMPLETED', 'SUCCESS', NULL, '2026-09-24 12:40:45.167', '2026-09-24 12:41:17.408', 28.4512569, 77.4551363, 279.00, 0, 1, 'F:\\Sales Project\\backend\\uploads\\visits\\4-1790253670120.jpg', 28.4512569, 77.4551363, 279.00, '2026-09-24 12:41:10.075', '2026-09-24 12:41:10.183', '2026-09-24 12:42:31.219', '2026-09-24 12:40:45.170', '2026-09-24 12:42:31.221', NULL, 100.00, NULL, NULL, NULL, NULL),
(5, 1, 3, 9, NULL, NULL, 'COMPLETED', 'UNAVAILABLE', NULL, '2026-09-26 08:31:00.341', '2026-09-26 11:12:08.827', 28.4517060, 77.4555540, 107.00, 65, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-26 08:31:00.343', '2026-09-26 11:12:08.830', NULL, NULL, NULL, NULL, NULL, NULL),
(6, 1, 7, 10, NULL, NULL, 'COMPLETED', 'SUCCESS', 'testing complete', '2026-10-03 08:33:30.385', '2026-10-03 08:33:54.217', 28.4513085, 77.4551155, 187.00, 0, 1, 'F:\\Sales Project\\backend\\uploads\\visits\\6-1791016422945.jpg', 28.4513085, 77.4551155, 187.00, '2026-10-03 08:33:42.898', '2026-10-03 08:33:42.964', '2026-10-10 23:06:02.935', '2026-10-03 08:33:30.387', '2026-10-10 23:06:02.937', NULL, NULL, NULL, NULL, NULL, NULL),
(7, 4, 11, 14, NULL, NULL, 'COMPLETED', 'SUCCESS', 'Done visit', '2026-10-13 08:46:35.003', '2026-10-13 10:13:05.656', 28.4511087, 77.4557656, 20.00, 67, 1, '/var/www/Sales-tracking/backend/uploads/visits/7-1791886368645.jpg', 28.4511086, 77.4557660, 20.00, '2026-10-13 10:12:46.882', '2026-10-13 10:12:48.707', '2026-10-13 10:14:40.870', '2026-10-13 08:46:34.824', '2026-10-13 10:14:40.873', NULL, 2000.00, NULL, NULL, NULL, NULL),
(8, 4, 11, 14, NULL, NULL, 'COMPLETED', 'SUCCESS', 'Thank ', '2026-10-13 10:14:19.623', '2026-10-13 10:26:40.893', 28.4511036, 77.4557656, 14.16, 68, 1, '/var/www/Sales-tracking/backend/uploads/visits/8-1791887189670.jpg', 28.4511086, 77.4557656, 62.15, '2026-10-13 10:26:28.911', '2026-10-13 10:26:29.685', '2026-10-13 10:27:10.469', '2026-10-13 10:14:20.852', '2026-10-13 10:27:10.470', NULL, 2000.00, NULL, NULL, NULL, NULL),
(9, 4, 11, 19, NULL, NULL, 'COMPLETED', 'SUCCESS', 'Done', '2026-10-13 10:41:23.353', '2026-10-13 10:42:02.836', 28.4511087, 77.4557658, 39.62, 67, 1, '/var/www/Sales-tracking/backend/uploads/visits/9-1791888118199.jpg', 28.4511537, 77.4557895, 77.86, '2026-10-13 10:41:54.761', '2026-10-13 10:41:58.210', '2026-10-13 10:42:55.067', '2026-10-13 10:41:24.600', '2026-10-13 10:42:55.068', NULL, 5000.00, NULL, NULL, NULL, NULL),
(10, 4, 11, 15, NULL, NULL, 'COMPLETED', 'SUCCESS', NULL, '2026-10-13 12:02:16.260', '2026-10-13 12:02:56.542', 28.4511221, 77.4557888, 37.27, 93, 1, '/var/www/Sales-tracking/backend/uploads/visits/10-1791892963599.jpg', 28.4511083, 77.4557662, 389.18, '2026-10-13 12:02:42.340', '2026-10-13 12:02:43.613', '2026-10-13 12:04:44.478', '2026-10-13 12:02:17.199', '2026-10-13 12:04:44.479', NULL, 10000.00, NULL, NULL, NULL, NULL),
(11, 4, 11, 15, NULL, NULL, 'COMPLETED', 'SUCCESS', NULL, '2026-10-13 12:11:47.782', '2026-10-24 07:09:22.154', 28.4511084, 77.4557661, 20.00, 67, 1, '/var/www/Sales-tracking/backend/uploads/visits/11-1792187373833.jpg', 28.4577040, 77.4600824, 72.00, '2026-10-16 21:49:32.491', '2026-10-16 21:49:33.842', NULL, '2026-10-13 12:11:48.727', '2026-10-24 07:09:23.708', NULL, NULL, 67, 28.4511287, 77.4557667, 20.00),
(12, 4, 13, 21, NULL, NULL, 'COMPLETED', 'SUCCESS', 'Kaam hogya ', '2026-10-13 18:52:36.887', '2026-10-13 18:53:35.159', 28.4576695, 77.4601106, 28.10, 9, 1, '/var/www/Sales-tracking/backend/uploads/visits/12-1791917583014.jpg', 28.4576695, 77.4601106, 70.24, '2026-10-13 18:53:01.267', '2026-10-13 18:53:03.034', '2026-10-13 18:54:42.053', '2026-10-13 18:52:37.792', '2026-10-13 18:54:42.054', NULL, 500.00, 4, 28.4576971, 77.4600216, 34.40),
(13, 1, 3, 13, NULL, 12, 'COMPLETED', 'SUCCESS', 'E2E proof', '2026-10-16 19:31:12.690', '2026-10-16 19:31:17.229', 28.6653992, 77.4069214, 12.00, 0, 1, 'F:\\Sales Project\\Sales-tracking\\backend\\uploads\\visits\\13-1792179074495.jpg', 28.6653992, 77.4069214, 12.00, '2026-10-16 19:31:15.018', '2026-10-16 19:31:15.018', NULL, '2026-10-16 19:31:12.695', '2026-10-16 19:31:17.231', NULL, NULL, 0, 28.6653992, 77.4069214, 12.00),
(14, 6, 15, 22, NULL, NULL, 'COMPLETED', 'SUCCESS', NULL, '2026-10-21 07:34:39.167', '2026-10-21 07:42:58.542', 28.4546618, 77.4550744, 149.60, 70, 1, '/var/www/Sales-tracking/backend/uploads/visits/14-1792568114295.jpg', 28.4546618, 77.4550744, 149.60, '2026-10-21 07:35:12.426', '2026-10-21 07:35:14.308', '2026-10-21 07:44:18.450', '2026-10-21 07:34:40.705', '2026-10-21 07:44:18.451', NULL, 5000.00, NULL, 28.4511792, 77.4557851, 39.17),
(15, 8, 20, 24, NULL, 21, 'IN_PROGRESS', NULL, NULL, '2026-10-23 12:10:56.953', NULL, 28.4513520, 77.4550950, 212.00, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-23 12:10:56.433', '2026-10-23 12:10:56.433', NULL, NULL, NULL, NULL, NULL, NULL),
(16, 4, 11, 16, NULL, 18, 'COMPLETED', 'SUCCESS', NULL, '2026-10-24 07:10:16.212', '2026-10-24 07:10:59.489', 28.4511299, 77.4557647, 23.60, 67, 1, '/var/www/Sales-tracking/backend/uploads/visits/16-1792825845971.jpg', 28.4511299, 77.4557647, 65.75, '2026-10-24 07:10:44.060', '2026-10-24 07:10:45.986', '2026-10-24 07:11:23.745', '2026-10-24 07:10:17.737', '2026-10-24 07:11:23.746', NULL, 100.00, 67, 28.4511295, 77.4557655, 20.00);

-- --------------------------------------------------------

--
-- Table structure for table `visitdemophoto`
--

CREATE TABLE `visitdemophoto` (
  `id` int(11) NOT NULL,
  `tenantId` int(11) NOT NULL,
  `visitId` int(11) NOT NULL,
  `path` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `visitdemophoto`
--

INSERT INTO `visitdemophoto` (`id`, `tenantId`, `visitId`, `path`, `createdAt`) VALUES
(1, 4, 11, '/var/www/Sales-tracking/backend/uploads/visit-demo/11-demo-1792187314543.jpg', '2026-10-16 21:48:34.555'),
(2, 6, 14, '/var/www/Sales-tracking/backend/uploads/visit-demo/14-demo-1792568131531.jpg', '2026-10-21 07:35:31.537');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `beat`
--
ALTER TABLE `beat`
  ADD PRIMARY KEY (`id`),
  ADD KEY `beat_tenantId_assigneeId_active_idx` (`tenantId`,`assigneeId`,`active`),
  ADD KEY `beat_assigneeId_fkey` (`assigneeId`);

--
-- Indexes for table `beatmember`
--
ALTER TABLE `beatmember`
  ADD PRIMARY KEY (`id`),
  ADD KEY `beatmember_beatId_sequence_idx` (`beatId`,`sequence`),
  ADD KEY `beatmember_leadId_fkey` (`leadId`),
  ADD KEY `beatmember_customerId_fkey` (`customerId`);

--
-- Indexes for table `beatplan`
--
ALTER TABLE `beatplan`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `beatplan_tenantId_userId_key` (`tenantId`,`userId`),
  ADD KEY `beatplan_userId_fkey` (`userId`);

--
-- Indexes for table `beatschedule`
--
ALTER TABLE `beatschedule`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `beatschedule_tenantId_userId_dayIndex_key` (`tenantId`,`userId`,`dayIndex`),
  ADD KEY `beatschedule_tenantId_userId_idx` (`tenantId`,`userId`),
  ADD KEY `beatschedule_userId_fkey` (`userId`),
  ADD KEY `beatschedule_beatId_fkey` (`beatId`);

--
-- Indexes for table `beatstop`
--
ALTER TABLE `beatstop`
  ADD PRIMARY KEY (`id`),
  ADD KEY `BeatStop_tenantId_userId_plannedAt_idx` (`tenantId`,`userId`,`plannedAt`),
  ADD KEY `BeatStop_userId_fkey` (`userId`),
  ADD KEY `BeatStop_leadId_fkey` (`leadId`),
  ADD KEY `BeatStop_customerId_fkey` (`customerId`),
  ADD KEY `beatstop_beatId_plannedAt_idx` (`beatId`,`plannedAt`);

--
-- Indexes for table `customer`
--
ALTER TABLE `customer`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Customer_tenantId_phone_key` (`tenantId`,`phone`),
  ADD KEY `Customer_ownerId_fkey` (`ownerId`);

--
-- Indexes for table `device`
--
ALTER TABLE `device`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Device_userId_deviceUid_key` (`userId`,`deviceUid`);

--
-- Indexes for table `emailotp`
--
ALTER TABLE `emailotp`
  ADD PRIMARY KEY (`id`),
  ADD KEY `emailotp_email_purpose_createdAt_idx` (`email`,`purpose`,`createdAt`);

--
-- Indexes for table `followup`
--
ALTER TABLE `followup`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `FollowUp_tenantId_clientRequestId_key` (`tenantId`,`clientRequestId`),
  ADD KEY `FollowUp_tenantId_userId_dueAt_idx` (`tenantId`,`userId`,`dueAt`),
  ADD KEY `FollowUp_userId_fkey` (`userId`),
  ADD KEY `FollowUp_leadId_fkey` (`leadId`),
  ADD KEY `FollowUp_customerId_fkey` (`customerId`);

--
-- Indexes for table `lead`
--
ALTER TABLE `lead`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Lead_tenantId_clientRequestId_key` (`tenantId`,`clientRequestId`),
  ADD KEY `Lead_tenantId_phone_idx` (`tenantId`,`phone`),
  ADD KEY `Lead_tenantId_assigneeId_status_idx` (`tenantId`,`assigneeId`,`status`),
  ADD KEY `Lead_assigneeId_fkey` (`assigneeId`),
  ADD KEY `Lead_createdById_fkey` (`createdById`),
  ADD KEY `Lead_customerId_fkey` (`customerId`),
  ADD KEY `Lead_tenantId_approvalStatus_idx` (`tenantId`,`approvalStatus`),
  ADD KEY `Lead_approvedById_fkey` (`approvedById`);

--
-- Indexes for table `locationlog`
--
ALTER TABLE `locationlog`
  ADD PRIMARY KEY (`id`),
  ADD KEY `LocationLog_sessionId_capturedAt_idx` (`sessionId`,`capturedAt`),
  ADD KEY `LocationLog_tenantId_userId_receivedAt_idx` (`tenantId`,`userId`,`receivedAt`),
  ADD KEY `LocationLog_userId_fkey` (`userId`);

--
-- Indexes for table `locationsession`
--
ALTER TABLE `locationsession`
  ADD PRIMARY KEY (`id`),
  ADD KEY `LocationSession_tenantId_userId_status_idx` (`tenantId`,`userId`,`status`),
  ADD KEY `LocationSession_userId_fkey` (`userId`);

--
-- Indexes for table `monthlytarget`
--
ALTER TABLE `monthlytarget`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `MonthlyTarget_tenantId_userId_year_month_key` (`tenantId`,`userId`,`year`,`month`),
  ADD KEY `MonthlyTarget_tenantId_year_month_idx` (`tenantId`,`year`,`month`),
  ADD KEY `MonthlyTarget_userId_fkey` (`userId`);

--
-- Indexes for table `refreshtoken`
--
ALTER TABLE `refreshtoken`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `RefreshToken_tokenHash_key` (`tokenHash`),
  ADD KEY `RefreshToken_userId_fkey` (`userId`),
  ADD KEY `RefreshToken_deviceId_fkey` (`deviceId`);

--
-- Indexes for table `role`
--
ALTER TABLE `role`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Role_tenantId_code_key` (`tenantId`,`code`);

--
-- Indexes for table `sale`
--
ALTER TABLE `sale`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Sale_tenantId_clientRequestId_key` (`tenantId`,`clientRequestId`),
  ADD KEY `Sale_tenantId_userId_createdAt_idx` (`tenantId`,`userId`,`createdAt`),
  ADD KEY `Sale_userId_fkey` (`userId`),
  ADD KEY `Sale_customerId_fkey` (`customerId`),
  ADD KEY `Sale_leadId_fkey` (`leadId`),
  ADD KEY `Sale_visitId_fkey` (`visitId`);

--
-- Indexes for table `team`
--
ALTER TABLE `team`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Team_tenantId_fkey` (`tenantId`);

--
-- Indexes for table `teammember`
--
ALTER TABLE `teammember`
  ADD PRIMARY KEY (`teamId`,`userId`),
  ADD KEY `TeamMember_userId_fkey` (`userId`);

--
-- Indexes for table `tenant`
--
ALTER TABLE `tenant`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Tenant_slug_key` (`slug`);

--
-- Indexes for table `tenantsettings`
--
ALTER TABLE `tenantsettings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `TenantSettings_tenantId_key` (`tenantId`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `User_tenantId_phone_key` (`tenantId`,`phone`),
  ADD UNIQUE KEY `user_tenantId_employeeId_key` (`tenantId`,`employeeId`);

--
-- Indexes for table `userrole`
--
ALTER TABLE `userrole`
  ADD PRIMARY KEY (`userId`,`roleId`),
  ADD KEY `UserRole_roleId_fkey` (`roleId`);

--
-- Indexes for table `visit`
--
ALTER TABLE `visit`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Visit_tenantId_userId_checkedInAt_idx` (`tenantId`,`userId`,`checkedInAt`),
  ADD KEY `Visit_userId_fkey` (`userId`),
  ADD KEY `Visit_leadId_fkey` (`leadId`),
  ADD KEY `Visit_customerId_fkey` (`customerId`),
  ADD KEY `Visit_beatStopId_fkey` (`beatStopId`);

--
-- Indexes for table `visitdemophoto`
--
ALTER TABLE `visitdemophoto`
  ADD PRIMARY KEY (`id`),
  ADD KEY `visitdemophoto_visitId_idx` (`visitId`),
  ADD KEY `visitdemophoto_tenantId_visitId_idx` (`tenantId`,`visitId`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `beat`
--
ALTER TABLE `beat`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `beatmember`
--
ALTER TABLE `beatmember`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `beatplan`
--
ALTER TABLE `beatplan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `beatschedule`
--
ALTER TABLE `beatschedule`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `beatstop`
--
ALTER TABLE `beatstop`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `customer`
--
ALTER TABLE `customer`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `device`
--
ALTER TABLE `device`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `emailotp`
--
ALTER TABLE `emailotp`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `followup`
--
ALTER TABLE `followup`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `lead`
--
ALTER TABLE `lead`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `locationlog`
--
ALTER TABLE `locationlog`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `locationsession`
--
ALTER TABLE `locationsession`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `monthlytarget`
--
ALTER TABLE `monthlytarget`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `refreshtoken`
--
ALTER TABLE `refreshtoken`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=429;

--
-- AUTO_INCREMENT for table `role`
--
ALTER TABLE `role`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `sale`
--
ALTER TABLE `sale`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `team`
--
ALTER TABLE `team`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tenant`
--
ALTER TABLE `tenant`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `tenantsettings`
--
ALTER TABLE `tenantsettings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `visit`
--
ALTER TABLE `visit`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `visitdemophoto`
--
ALTER TABLE `visitdemophoto`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `beat`
--
ALTER TABLE `beat`
  ADD CONSTRAINT `beat_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `beat_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `beatmember`
--
ALTER TABLE `beatmember`
  ADD CONSTRAINT `beatmember_beatId_fkey` FOREIGN KEY (`beatId`) REFERENCES `beat` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `beatmember_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `beatmember_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `beatplan`
--
ALTER TABLE `beatplan`
  ADD CONSTRAINT `beatplan_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `beatplan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `beatschedule`
--
ALTER TABLE `beatschedule`
  ADD CONSTRAINT `beatschedule_beatId_fkey` FOREIGN KEY (`beatId`) REFERENCES `beat` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `beatschedule_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `beatschedule_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `beatstop`
--
ALTER TABLE `beatstop`
  ADD CONSTRAINT `beatstop_beatId_fkey` FOREIGN KEY (`beatId`) REFERENCES `beat` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `beatstop_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `beatstop_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `beatstop_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `beatstop_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `customer`
--
ALTER TABLE `customer`
  ADD CONSTRAINT `customer_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `device`
--
ALTER TABLE `device`
  ADD CONSTRAINT `device_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `followup`
--
ALTER TABLE `followup`
  ADD CONSTRAINT `followup_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `followup_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `followup_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `followup_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `lead`
--
ALTER TABLE `lead`
  ADD CONSTRAINT `lead_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `lead_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `lead_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `lead_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `lead_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `locationlog`
--
ALTER TABLE `locationlog`
  ADD CONSTRAINT `locationlog_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `locationsession` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `locationlog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `locationlog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `locationsession`
--
ALTER TABLE `locationsession`
  ADD CONSTRAINT `locationsession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `locationsession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `monthlytarget`
--
ALTER TABLE `monthlytarget`
  ADD CONSTRAINT `monthlytarget_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `monthlytarget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `refreshtoken`
--
ALTER TABLE `refreshtoken`
  ADD CONSTRAINT `refreshtoken_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `device` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `refreshtoken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `role`
--
ALTER TABLE `role`
  ADD CONSTRAINT `role_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `sale`
--
ALTER TABLE `sale`
  ADD CONSTRAINT `sale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `sale_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `sale_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sale_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sale_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `visit` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `team`
--
ALTER TABLE `team`
  ADD CONSTRAINT `team_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `teammember`
--
ALTER TABLE `teammember`
  ADD CONSTRAINT `teammember_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `team` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `teammember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `tenantsettings`
--
ALTER TABLE `tenantsettings`
  ADD CONSTRAINT `tenantsettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user`
--
ALTER TABLE `user`
  ADD CONSTRAINT `user_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `userrole`
--
ALTER TABLE `userrole`
  ADD CONSTRAINT `userrole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `userrole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `visit`
--
ALTER TABLE `visit`
  ADD CONSTRAINT `visit_beatStopId_fkey` FOREIGN KEY (`beatStopId`) REFERENCES `beatstop` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `visit_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `visit_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `lead` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `visit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `visit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `visitdemophoto`
--
ALTER TABLE `visitdemophoto`
  ADD CONSTRAINT `visitdemophoto_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `visit` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
