@echo off
title Sistema de Inventario - Restaurante
chcp 65001 >nul
cls

echo ===================================================================
echo             SISTEMA DE CONTROL DE BODEGA & BEBIDAS
echo ===================================================================
echo.
echo  Iniciando el servidor de la aplicacion...
cd /d "d:\inventario"

:: Abrir automaticamente el navegador tras unos segundos
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

echo.
echo  ===================================================================
echo   El sistema esta activo y listo para usar:
echo.
echo   * En esta computadora:  http://localhost:3000
echo   * Desde cualquier celular en tu Wi-Fi: (mira la IP local arriba)
echo.
echo   Para cerrar el sistema cuando termines, cierra esta ventana.
echo  ===================================================================
echo.

npm.cmd run dev
