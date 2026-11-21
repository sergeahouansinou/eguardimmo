<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

/**
 * `PING` du démon clamd : `PONG` en réponse, sinon l'état reste indéterminé. Un démon qui refuse la connexion est arrêté ; un délai dépassé
 * ou une réponse inattendue ne prouvent rien (ADR 0011 : jamais `ok` ni `down` par défaut).
 */
final class ClamdPing
{
    /**
     * @return 'ok'|'down'|'unknown'
     */
    public static function state(string $adresse, int $delaiSecondes): string
    {
        $connexion = @stream_socket_client($adresse, $code, $message, $delaiSecondes);

        if ($connexion === false) {
            return in_array($code, [61, 111, 2, 13], true) ? 'down' : 'unknown';
        }

        try {
            stream_set_timeout($connexion, $delaiSecondes);

            if (@fwrite($connexion, "zPING\0") === false) {
                return 'unknown';
            }

            $reponse = stream_get_contents($connexion);

            return is_string($reponse) && trim($reponse, "\0 \n\r") === 'PONG' ? 'ok' : 'unknown';
        } finally {
            fclose($connexion);
        }
    }
}
