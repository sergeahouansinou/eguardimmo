<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\ScanVerdict;
use Illuminate\Support\Facades\Log;

/**
 * Client `clamd` (protocole `INSTREAM`, sans paquet Composer) sur une socket Unix ou TCP. Toute réponse autre que « OK » ou « FOUND »
 * (délai dépassé, taille refusée, démon arrêté) est `Unverifiable` : la pièce reste bloquée, jamais livrée.
 */
final readonly class ClamdScanner implements MalwareScanner
{
    private const int MORCEAU = 8192;

    public function __construct(
        private string $adresse,
        private int $delaiSecondes = 15,
    ) {}

    public function scan($flux): ScanVerdict
    {
        $connexion = @stream_socket_client($this->adresse, $codeErreur, $messageErreur, $this->delaiSecondes);

        if ($connexion === false) {
            Log::warning('clamd injoignable', ['code' => $codeErreur]);

            return ScanVerdict::Unverifiable;
        }

        stream_set_timeout($connexion, $this->delaiSecondes);

        try {
            return $this->analyser($connexion, $flux);
        } finally {
            fclose($connexion);
        }
    }

    public function enabled(): bool
    {
        return true;
    }

    /**
     * @param  resource  $connexion
     * @param  resource  $flux
     */
    private function analyser($connexion, $flux): ScanVerdict
    {
        if (@fwrite($connexion, "zINSTREAM\0") === false) {
            return ScanVerdict::Unverifiable;
        }

        while (! feof($flux)) {
            $morceau = fread($flux, self::MORCEAU);

            if ($morceau === false) {
                return ScanVerdict::Unverifiable;
            }

            if ($morceau === '') {
                continue;
            }

            if (@fwrite($connexion, pack('N', strlen($morceau)).$morceau) === false) {
                return ScanVerdict::Unverifiable;
            }
        }

        if (@fwrite($connexion, pack('N', 0)) === false) {
            return ScanVerdict::Unverifiable;
        }

        $reponse = stream_get_contents($connexion);

        return is_string($reponse) ? self::verdict($reponse) : ScanVerdict::Unverifiable;
    }

    public static function verdict(string $reponse): ScanVerdict
    {
        $texte = trim($reponse, "\0 \n\r");

        return match (true) {
            str_ends_with($texte, ' OK') => ScanVerdict::Clean,
            str_ends_with($texte, ' FOUND') => ScanVerdict::Infected,
            default => ScanVerdict::Unverifiable,
        };
    }
}
