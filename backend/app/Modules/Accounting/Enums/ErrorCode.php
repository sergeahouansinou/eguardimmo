<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case EntryNotFound = 'entry_not_found';
    case EntryUnbalanced = 'entry_unbalanced';
    case EntryInvalid = 'entry_invalid';
    case IdempotencyKeyReused = 'idempotency_key_reused';
    case EntryAlreadyReversed = 'entry_already_reversed';
    case EntryIsReversal = 'entry_is_reversal';
    case StatementTooLong = 'statement_too_long';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::EntryNotFound => 404,
            self::EntryUnbalanced, self::EntryInvalid, self::StatementTooLong => 422,
            self::IdempotencyKeyReused, self::EntryAlreadyReversed, self::EntryIsReversal => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::EntryNotFound => 'Écriture introuvable',
            self::EntryUnbalanced => 'Écriture déséquilibrée',
            self::EntryInvalid => 'Écriture invalide',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée',
            self::EntryAlreadyReversed => 'Écriture déjà contre-passée',
            self::EntryIsReversal => 'Contre-passation non contre-passable',
            self::StatementTooLong => 'Relevé trop long',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::EntryNotFound => 'Cette écriture n\'existe pas ou n\'appartient pas à votre organisation.',
            self::EntryUnbalanced => 'Le total des débits doit égaler le total des crédits, devise par devise.',
            self::EntryInvalid => 'Cette écriture ne respecte pas les règles du grand livre.',
            self::IdempotencyKeyReused => 'Cette clé d\'idempotence a déjà servi pour une écriture différente.',
            self::EntryAlreadyReversed => 'Cette écriture a déjà été contre-passée à une autre date.',
            self::EntryIsReversal => 'Une contre-passation ne se contre-passe pas : passez une nouvelle écriture.',
            self::StatementTooLong => 'Ce relevé dépasse le nombre de lignes affichables : réduisez la période.',
        };
    }
}
