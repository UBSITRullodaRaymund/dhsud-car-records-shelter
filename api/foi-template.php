<?php
declare(strict_types=1);

$templatePath = dirname(__DIR__) . '/FOI FORM_2023_REV 07.17.26 .pdf';

if (!is_file($templatePath) || !is_readable($templatePath)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('FOI form template is unavailable.');
}

$pdfBytes = file_get_contents($templatePath);
if ($pdfBytes === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit('FOI form template could not be read.');
}

if (strncmp($pdfBytes, '%PDF-', 5) !== 0) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit('FOI form template is not a valid PDF.');
}

if (ob_get_level() > 0) {
    ob_clean();
}
header('Content-Type: application/pdf');
header('Content-Length: ' . (string) strlen($pdfBytes));
header('Content-Disposition: inline; filename="FOI-form-template.pdf"');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $pdfBytes;
