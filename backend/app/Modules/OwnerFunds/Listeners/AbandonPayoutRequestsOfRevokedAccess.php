<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Listeners;

use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Support\AbandonedPayoutRequests;
use App\Modules\Parties\Events\OwnerAccessRevoked;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

/**
 * Un accès révoqué n'a plus de demande de compte de paiement en cours (ADR 0032, décision 2). L'événement part après la
 * validation de la révocation : la fenêtre entre les deux est fermée par la revérification de l'accès à l'approbation.
 */
final readonly class AbandonPayoutRequestsOfRevokedAccess
{
    public function __construct(
        private CurrentOrganization $contexte,
        private AbandonedPayoutRequests $abandons,
    ) {}

    public function handle(OwnerAccessRevoked $evenement): void
    {
        $this->contexte->run($evenement->organizationId, function () use ($evenement): void {
            DB::transaction(function () use ($evenement): void {
                $vivantes = PayoutAccountRequest::query()
                    ->where('access_id', $evenement->accessId)
                    ->whereIn('status', [PayoutAccountRequestStatus::AwaitingCode->value, PayoutAccountRequestStatus::Pending->value])
                    ->lockForUpdate()->get();

                foreach ($vivantes as $demande) {
                    $this->abandons->abandon($demande, 'access_revoked');
                }
            });
        });
    }
}
