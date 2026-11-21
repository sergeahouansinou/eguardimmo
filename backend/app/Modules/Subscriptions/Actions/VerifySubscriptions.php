<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Actions;

use Illuminate\Support\Facades\DB;

final readonly class VerifySubscriptions
{
    public function __construct(private StartTrial $essai) {}

    /**
     * Rattrape les organisations sans abonnement (créées avant le module, ou pendant une grille non chargée). Lecture SQL des identifiants de
     * `organizations` ; la devise de l'essai vient d'Organizations (`StartTrial`).
     *
     * @return array{missing: int, created: int}
     */
    public function handle(): array
    {
        $manquantes = DB::table('organizations')
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('subscriptions')->whereColumn('subscriptions.organization_id', 'organizations.id'))
            ->get(['id']);

        $creees = 0;
        foreach ($manquantes as $ligne) {
            if ($this->essai->handle((string) $ligne->id) !== null) {
                $creees++;
            }
        }

        return ['missing' => $manquantes->count(), 'created' => $creees];
    }
}
