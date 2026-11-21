<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

final readonly class ReferenceContext
{
    /**
     * @param  bool  $recipientIsMandant  le destinataire est le mandant du mandat référencé
     * @param  bool  $recipientOnLease  le destinataire est partie au bail référencé : la créance suit alors le bail
     * @param  bool  $recipientIsVatRegisteredCompany  le destinataire est une société portant un numéro de TVA
     */
    public function __construct(
        public bool $recipientIsMandant,
        public bool $recipientOnLease,
        public bool $recipientIsVatRegisteredCompany,
        public ?string $leaseReference,
        public ?string $mandateReference,
    ) {}
}
