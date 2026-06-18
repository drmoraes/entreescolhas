<?php
// ═══════════════════════════════════════════════════════════
// Mailer — cliente SMTP mínimo (sem dependências externas)
// Usa as constantes SMTP_* definidas em config.php (Locaweb)
// ═══════════════════════════════════════════════════════════

class Mailer
{
    private $socket;
    private array $errors = [];

    public function getLastError(): string
    {
        return end($this->errors) ?: '';
    }

    /**
     * Envia um e-mail HTML simples.
     * @param string $to       Destinatário
     * @param string $subject  Assunto
     * @param string $html     Corpo em HTML
     * @param string $altText  Versão em texto puro (fallback)
     */
    public function send(string $to, string $subject, string $html, string $altText = ''): bool
    {
        try {
            $this->connect();
            $this->hello();
            if (SMTP_SECURE === 'tls') {
                $this->command("STARTTLS", 220);
                if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new Exception('Falha ao iniciar TLS');
                }
                $this->hello(); // EHLO de novo após TLS
            }
            $this->command("AUTH LOGIN", 334);
            $this->command(base64_encode(SMTP_USER), 334);
            $this->command(base64_encode(SMTP_PASS), 235);
            $this->command("MAIL FROM:<" . SMTP_USER . ">", 250);
            $this->command("RCPT TO:<" . $to . ">", 250);
            $this->command("DATA", 354);

            $boundary = md5((string) microtime(true));
            $altText  = $altText ?: 'Abra este e-mail em um cliente que exiba HTML.';

            $headers   = [];
            $headers[] = 'From: ' . SMTP_FROM_NAME . ' <' . SMTP_USER . '>';
            $headers[] = 'To: <' . $to . '>';
            $headers[] = 'Subject: ' . $this->encodeSubject($subject);
            $headers[] = 'MIME-Version: 1.0';
            $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
            $headers[] = 'Date: ' . date('r');

            $body  = "--{$boundary}\r\n";
            $body .= "Content-Type: text/plain; charset=utf-8\r\n\r\n";
            $body .= $altText . "\r\n";
            $body .= "--{$boundary}\r\n";
            $body .= "Content-Type: text/html; charset=utf-8\r\n\r\n";
            $body .= $html . "\r\n";
            $body .= "--{$boundary}--\r\n";

            $message = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.";
            $this->command($message, 250);
            $this->command("QUIT", 221);
            $this->disconnect();
            return true;
        } catch (Throwable $e) {
            $this->errors[] = $e->getMessage();
            $this->disconnect();
            return false;
        }
    }

    private function connect(): void
    {
        $prefix = SMTP_SECURE === 'ssl' ? 'ssl://' : 'tcp://';
        $this->socket = @stream_socket_client(
            $prefix . SMTP_HOST . ':' . SMTP_PORT,
            $errno,
            $errstr,
            15
        );
        if (!$this->socket) {
            throw new Exception("Não foi possível conectar ao SMTP: $errstr ($errno)");
        }
        $this->readResponse(); // banner 220
    }

    private function hello(): void
    {
        $this->command("EHLO " . parse_url(APP_BASE_URL, PHP_URL_HOST), 250);
    }

    private function command(string $cmd, int $expectedCode): string
    {
        // Para o comando DATA, o conteúdo já vem com "\r\n." no final
        fwrite($this->socket, $cmd . "\r\n");
        $response = $this->readResponse();
        $code = (int) substr($response, 0, 3);
        if ($code !== $expectedCode) {
            throw new Exception("SMTP esperava {$expectedCode}, recebeu: {$response}");
        }
        return $response;
    }

    private function readResponse(): string
    {
        $data = '';
        while ($line = fgets($this->socket, 515)) {
            $data .= $line;
            // Linha final de uma resposta multi-linha é "CODE seguido de espaço"
            if (preg_match('/^\d{3} /', $line)) break;
        }
        return $data;
    }

    private function encodeSubject(string $subject): string
    {
        // Codifica o assunto em UTF-8 (MIME) para acentuação correta
        return '=?UTF-8?B?' . base64_encode($subject) . '?=';
    }

    private function disconnect(): void
    {
        if (is_resource($this->socket)) {
            fclose($this->socket);
        }
    }
}
