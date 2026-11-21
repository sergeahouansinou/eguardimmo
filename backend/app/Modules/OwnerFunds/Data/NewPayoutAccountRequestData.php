<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Data;

use Illuminate\Http\UploadedFile;

final readonly class NewPayoutAccountRequestData
{
    public function __construct(
        public string $mandantPartyId,
        public string $accessId,
        #[\SensitiveParameter] public string $iban,
        public ?string $bic,
        public string $holderName,
        public UploadedFile $proof,
    ) {}
}
