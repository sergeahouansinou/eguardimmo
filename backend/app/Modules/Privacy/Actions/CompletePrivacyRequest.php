<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Events\PrivacyExportReady;
use App\Modules\Privacy\Events\PrivacyRequestCompleted;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Queries\PrivacyRequests;
use App\Modules\Privacy\Support\ExportBuilder;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Support\Facades\DB;
use Throwable;

final readonly class CompletePrivacyRequest
{
    public function __construct(private PrivacyRequests $demandes, private ExportBuilder $export, private RequestJournal $journal) {}

    /**
     * Clôt une demande dont l'identité est vérifiée. Accès et portabilité d'un compte produisent l'export, que seul le demandeur télécharge ;
     * l'effacement d'un compte passe par la double validation.
     */
    public function handle(string $id, User $operateur): PrivacyRequest
    {
        $chemin = null;

        try {
            return DB::transaction(function () use ($id, $operateur, &$chemin): PrivacyRequest {
                $demande = $this->demandes->forUpdate($id);

                if (! $demande->status->isOpen()) {
                    throw ErrorCode::RequestClosed->problem();
                }

                if (! $demande->isIdentityVerified()) {
                    throw ErrorCode::IdentityNotVerified->problem();
                }

                if ($demande->kind === RequestKind::Erasure && $demande->requester_user_id !== null) {
                    throw ErrorCode::ErasureRequiresApproval->problem();
                }

                $genereUnExport = $demande->kind->producesExport() && $demande->requester_user_id !== null;

                if ($genereUnExport) {
                    $chemin = $this->export->build($demande, (string) $demande->requester_user_id);
                    $demande->forceFill([
                        'export_path' => $chemin,
                        'export_generated_at' => now(),
                        'export_expires_at' => now()->addDays((int) config('privacy.export_ttl_days')),
                    ]);
                    $this->journal->record($demande, EventKind::Exported, $operateur->id, [], 'privacy.request.exported');
                }

                $demande->forceFill(['status' => RequestStatus::Completed, 'completed_at' => now(), 'handled_by_user_id' => $operateur->id])->save();
                $this->journal->record($demande, EventKind::Completed, $operateur->id, ['export' => $genereUnExport], 'privacy.request.completed');

                if ($demande->requester_user_id !== null) {
                    $genereUnExport
                        ? PrivacyExportReady::dispatch($demande->id, $demande->requester_user_id)
                        : PrivacyRequestCompleted::dispatch($demande->id, $demande->requester_user_id);
                }

                return $demande;
            });
        } catch (Throwable $erreur) {
            if ($chemin !== null) {
                $this->export->delete($chemin);
            }

            throw $erreur;
        }
    }
}
