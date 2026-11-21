<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\AccountContacts;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RequestChannel;
use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Events\PrivacyRequestReceived;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Support\Deadlines;
use App\Modules\Privacy\Support\RequestJournal;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use SensitiveParameter;

final readonly class RecordOffAppRequest
{
    public function __construct(private RequestJournal $journal, private AccountContacts $comptes, private RecordAudit $audit) {}

    /**
     * Saisie par la conformité d'une demande reçue par courrier ou e-mail : l'échéance court depuis la réception, l'identité reste à vérifier.
     * L'adresse n'est conservée que chiffrée, avec son empreinte ; un compte portant cette adresse est lié à la demande.
     */
    public function handle(User $operateur, RequestKind $type, RequestChannel $canal, #[SensitiveParameter] string $adresse, CarbonImmutable $recueLe): PrivacyRequest
    {
        $adresse = mb_strtolower(trim($adresse));

        try {
            return DB::transaction(function () use ($operateur, $type, $canal, $adresse, $recueLe): PrivacyRequest {
                $compteId = $this->comptes->idByEmail($adresse);
                $empreinte = $this->audit->fingerprint($adresse);

                $ouverte = PrivacyRequest::query()
                    ->where('kind', $type)
                    ->whereIn('status', [RequestStatus::Received, RequestStatus::InProgress])
                    ->where(fn ($q) => $q->where('requester_email_fingerprint', $empreinte)->when($compteId !== null, fn ($q2) => $q2->orWhere('requester_user_id', $compteId)))
                    ->exists();

                if ($ouverte) {
                    throw ErrorCode::RequestExists->problem();
                }

                $demande = PrivacyRequest::query()->create([
                    'requester_user_id' => $compteId,
                    'requester_email' => $adresse,
                    'requester_email_fingerprint' => $empreinte,
                    'kind' => $type,
                    'channel' => $canal,
                    'received_at' => $recueLe,
                    'due_at' => Deadlines::dueAt($recueLe),
                    'handled_by_user_id' => $operateur->id,
                    'status' => RequestStatus::Received,
                ]);

                $this->journal->record($demande, EventKind::Received, $operateur->id, ['channel' => $canal->value, 'account_linked' => $compteId !== null], 'privacy.request.received');

                if ($compteId !== null) {
                    PrivacyRequestReceived::dispatch($demande->id, $compteId);
                }

                return $demande;
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::RequestExists->problem();
        }
    }
}
