<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Data\CreditNoteData;
use App\Modules\Invoicing\Data\DraftData;
use App\Modules\Invoicing\Data\NewLineData;
use App\Modules\Invoicing\Data\NewPaymentData;

/**
 * Empreinte du contenu d'une demande : même clé d'idempotence et même empreinte rejouent, une empreinte différente est refusée.
 */
final class DraftFingerprint
{
    public static function draft(DraftData $d): string
    {
        return self::hash([
            $d->recipientPartyId, $d->leaseId, $d->mandateId, $d->dueOn, $d->serviceFrom, $d->serviceTo,
            array_map(fn (NewLineData $l): array => [$l->itemTermId, $l->description, $l->quantityMilli, $l->unitPrice, $l->taxCategory->value, $l->taxRateKey], $d->lines),
        ]);
    }

    public static function creditNote(string $invoiceId, CreditNoteData $d): string
    {
        return self::hash([$invoiceId, $d->reason, $d->full, array_map(fn ($l): array => [$l->lineId, $l->quantityMilli], $d->lines)]);
    }

    public static function payment(string $invoiceId, NewPaymentData $d): string
    {
        return self::hash([$invoiceId, $d->amount, $d->method->value, $d->paidOn, $d->reference]);
    }

    /**
     * @param  array<mixed>  $contenu
     */
    private static function hash(array $contenu): string
    {
        return hash('sha256', (string) json_encode($contenu, JSON_THROW_ON_ERROR));
    }
}
