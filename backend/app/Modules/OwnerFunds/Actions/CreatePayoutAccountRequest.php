<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Data\NewPayoutAccountRequestData;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Events\PayoutAccountChangeRequested;
use App\Modules\OwnerFunds\Jurisdictions\OwnerFundsJurisdictions;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\OwnerFunds\Notifications\PayoutAccountCodeNotification;
use App\Modules\OwnerFunds\Support\ConfirmationCode;
use App\Modules\OwnerFunds\Support\StalePayoutRequests;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

final readonly class CreatePayoutAccountRequest
{
    public function __construct(
        private Ledger $livre,
        private PartyBankAccounts $comptes,
        private DocumentStore $documents,
        private OrganizationDirectory $organisations,
        private OwnerFundsJurisdictions $juridictions,
        private StalePayoutRequests $perimees,
        private RecordAudit $audit,
    ) {}

    /**
     * Jamais d'effet immédiat : le compte demandé est écrit `pending` dans Parties, la demande attend le code reçu par e-mail
     * puis la validation de l'agence. Une seule demande vivante par mandant, et aucune tant qu'une contestation du mandant n'est
     * pas levée par l'agence.
     */
    public function handle(NewPayoutAccountRequestData $donnees, User $compte): PayoutAccountRequest
    {
        $pays = $this->comptes->countryOf($donnees->iban);

        if (! $this->comptes->isValidIban($donnees->iban) || ! in_array($pays, $this->juridictions->for($this->organisations->country())->payoutIbanCountries(), true)) {
            throw ErrorCode::IbanInvalid->problem();
        }

        $code = ConfirmationCode::generate();

        $demande = DB::transaction(function () use ($donnees, $compte, $code): PayoutAccountRequest {
            $this->livre->lockParty($donnees->mandantPartyId);
            $this->perimees->expire($donnees->mandantPartyId);

            if (PayoutHold::query()->where('mandant_party_id', $donnees->mandantPartyId)->where('reason', HoldReason::AccountChangeContested->value)->whereNull('released_at')->exists()) {
                throw ErrorCode::Contested->problem();
            }

            if (PayoutAccountRequest::query()->where('mandant_party_id', $donnees->mandantPartyId)->whereIn('status', [PayoutAccountRequestStatus::AwaitingCode->value, PayoutAccountRequestStatus::Pending->value])->exists()) {
                throw ErrorCode::RequestPending->problem();
            }

            $nouveau = $this->comptes->stage($donnees->mandantPartyId, $donnees->iban, $donnees->bic, $donnees->holderName, CarbonImmutable::today())
                ?? throw ErrorCode::Unchanged->problem();
            $piece = $this->stocker($donnees->proof, $donnees->mandantPartyId);
            $demande = new PayoutAccountRequest;
            $demande->id = $demande->newUniqueId();
            $demande->fill([
                'mandant_party_id' => $donnees->mandantPartyId,
                'access_id' => $donnees->accessId,
                'requested_by_user_id' => $compte->id,
                'bank_account_id' => $nouveau->id,
                'proof_file_id' => $piece,
                'status' => PayoutAccountRequestStatus::AwaitingCode,
                'code_hash' => ConfirmationCode::hash($demande->id, $code),
            ]);
            $demande->save();
            $this->audit->handle('ownerfunds.payout_account.requested', subject: $demande, metadata: ['mandant_party_id' => $donnees->mandantPartyId, 'access_id' => $donnees->accessId]);
            Notification::send($compte, new PayoutAccountCodeNotification($code, (int) config('owner_funds.payout_code_minutes')));
            PayoutAccountChangeRequested::dispatch($demande->organization_id, $donnees->mandantPartyId, $demande->id);

            return $demande;
        });

        return $demande->refresh();
    }

    private function stocker(UploadedFile $fichier, string $mandantId): string
    {
        $chemin = $fichier->getRealPath();

        if ($chemin === false) {
            throw ErrorCode::IbanInvalid->problem('La pièce justificative est illisible.');
        }

        return $this->documents->store(
            FileSource::path($chemin),
            Str::limit(basename($fichier->getClientOriginalName()), 120, ''),
            FileCategory::Supporting,
            new DocumentSubject('party', $mandantId),
            CarbonImmutable::today()->addYears(max(1, (int) config('owner_funds.payout_proof_retention_years'))),
        )->id;
    }
}
