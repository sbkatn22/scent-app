# Perfumes & Reviews API

API for managing perfumes, reviews, daily scents, and user collections.

---

## Table of Contents

1. [Overview](#overview)  
2. [Authentication](#authentication)  
3. [Perfumes Endpoints](#perfumes-endpoints)  
    - [Search Fragrances](#search-fragrances-get)  
    - [Create Fragrance](#create-fragrance-post)  
    - [Get Fragrance by ID](#get-fragrance-by-id-get)  
4. [Reviews Endpoints](#reviews-endpoints)  
    - [Reviews for a Fragrance](#reviews-for-a-fragrance-get)  
    - [Reviews for a User](#reviews-for-a-user-get)  
    - [Create Review](#create-review-post)  
5. [Daily Scents](#daily-scents)  
    - [Create Daily Scent](#create-daily-scent-post)  
    - [Get Daily Scents](#get-daily-scents-get)  
6. [User Perfume Collection](#user-perfume-collection)  
    - [Toggle Collection](#toggle-collection-post)  
    - [Get Collection](#get-collection-get)  

---

## Overview

This API allows users to:

- Search and create perfumes  
- Fetch and aggregate perfume reviews  
- Record daily scents in Redis  
- Manage a personal perfume collection  

It integrates **Django ORM**, **PostgreSQL**, and **Upstash Redis**.

---

## Authentication

All user-specific endpoints require **Bearer token** authentication in headers. Example:
