<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\NoticeGivenBy;

final readonly class NoticeData
{
    /**
     * @param  string  $receivedOn  Y-m-d
     * @param  string|null  $departureOn  Y-m-d ; absent : minimum légal (locataire) ou terme du bail (bailleur)
     * @param  bool  $replace  remplace explicitement le préavis déjà enregistré
     * @param  string|null  $noticeRequestId  demande de congé du locataire que cet acte enregistre ; elle est clôturée dans la même transaction
     */
    public function __construct(
        public int $lockVersion,
        public NoticeGivenBy $givenBy,
        public string $receivedOn,
        public ?string $departureOn,
        public string $terminationReason,
        public bool $replace,
        public ?string $noticeRequestId = null,
    ) {}
}
