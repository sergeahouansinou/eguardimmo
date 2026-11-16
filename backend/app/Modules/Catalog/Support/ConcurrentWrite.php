<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use Closure;
use Illuminate\Database\UniqueConstraintViolationException;

final class ConcurrentWrite
{
    /**
     * Une écriture simultanée de la même ligne fait échouer la seconde sur l'unicité : rejouée dans une nouvelle
     * transaction, elle voit la ligne de la première et la met à jour.
     *
     * @template T
     *
     * @param  Closure(): T  $operation
     * @return T
     */
    public static function replayOnce(Closure $operation): mixed
    {
        try {
            return $operation();
        } catch (UniqueConstraintViolationException) {
            return $operation();
        }
    }
}
