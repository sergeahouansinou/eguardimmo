<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use RuntimeException;

final class TempFile
{
    /**
     * Fichier vide, créé en exclusivité et lisible par le seul processus ; l'appelant le supprime.
     */
    public static function create(): string
    {
        $chemin = sys_get_temp_dir().DIRECTORY_SEPARATOR.'eg-doc-'.bin2hex(random_bytes(16));
        $flux = @fopen($chemin, 'xb');

        if ($flux === false) {
            throw new RuntimeException('Fichier temporaire impossible à créer.');
        }

        fclose($flux);
        chmod($chemin, 0600);

        return $chemin;
    }
}
