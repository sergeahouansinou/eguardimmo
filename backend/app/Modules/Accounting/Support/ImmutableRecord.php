<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * @phpstan-require-extends Model
 */
trait ImmutableRecord
{
    public static function bootImmutableRecord(): void
    {
        static::updating(static fn (Model $modele): never => throw new LogicException('Une écriture comptable ne se modifie pas : passez une contre-passation.'));
        static::deleting(static fn (Model $modele): never => throw new LogicException('Une écriture comptable ne se supprime pas : passez une contre-passation.'));
    }
}
