<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ShowPayoutAccountProofController
{
    public function __invoke(string $payoutRequest, DocumentStore $documents): StreamedResponse
    {
        $demande = (Str::isUuid($payoutRequest) ? PayoutAccountRequest::query()->find($payoutRequest) : null) ?? throw ErrorCode::RequestNotFound->problem();

        return $documents->stream($demande->proof_file_id);
    }
}
