<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Models\PrivacyRequestForward;
use App\Modules\Privacy\Queries\RequestForwards;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Support\Facades\DB;

final readonly class MarkForwardHandled
{
    public function __construct(private RequestForwards $transmissions, private RequestJournal $journal) {}

    /**
     * L'organisation a traité la demande avec ses propres outils. Sans effet si elle l'a déjà marquée.
     */
    public function handle(string $id, User $membre): PrivacyRequestForward
    {
        return DB::transaction(function () use ($id, $membre): PrivacyRequestForward {
            $transmission = $this->transmissions->lockInCurrentOrganization($id);

            if ($transmission->handled_at !== null) {
                return $transmission;
            }

            $transmission->forceFill(['handled_at' => now(), 'handled_by_user_id' => $membre->id])->save();

            $this->journal->record($transmission->privacyRequest, EventKind::ForwardHandled, $membre->id, ['organization_id' => $transmission->organization_id], 'privacy.request.handled', $transmission);

            return $transmission;
        });
    }
}
