<?php

declare(strict_types=1);

namespace Tests\Feature\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Models\InterventionApproval;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Maintenance\MaintenanceContext as C;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Owner\OwnerReportingContext as X;

final class OwnerWriteContext
{
    /**
     * Agence avec un lot sous mandat (plafond 500,00) et un compte propriétaire rattaché, 2FA confirmée, navigateur de l'espace.
     *
     * @return array{scene: array<string, mixed>, awa: User}
     */
    public static function agence(object $test): array
    {
        C::preparer($test);
        config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
        $scene = C::agence(50000);
        $awa = X::rattacher($scene['org'], $scene['mandant']);
        activerDeuxFacteurs($awa);

        return ['scene' => $scene, 'awa' => $awa];
    }

    /**
     * Devis soumis au-dessus du plafond : l'accord du mandant est demandé.
     *
     * @param  array<string, mixed>  $scene
     * @return array{0: string, 1: string, 2: string} intervention, devis, demande
     */
    public static function demande(object $test, array $scene, int $prix = 60000): array
    {
        $id = C::enDevis($test, $scene, $prix);
        $devis = (string) C::devis($test, $scene, $id, $prix)->assertCreated()->json('data.id');
        $test->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
        $demande = (string) InterventionApproval::query()->withoutGlobalScopes()->where('quote_id', $devis)->value('id');

        return [$id, $devis, $demande];
    }

    /**
     * Ce que l'écran du mandant affiche d'une demande : version, empreinte et texte de mention à renvoyer à la décision.
     *
     * @return array{lock_version: int, quote_fingerprint: string, statement_version: string}
     */
    public static function vue(object $test, User $compte, string $intervention): array
    {
        $a = R::lire($test, $compte, '/interventions/'.$intervention)->assertOk()->json('data.approvals.0');

        return ['lock_version' => $a['lock_version'], 'quote_fingerprint' => $a['quote_fingerprint'], 'statement_version' => $a['statement_version'] ?? 'v1'];
    }

    /**
     * @param  array<string, mixed>  $corps
     * @param  array<string, mixed>  $vue
     */
    public static function decider(object $test, User $compte, string $intervention, string $demande, array $corps, ?string $cle = 'decision-cle-1', ?array $vue = null, bool $preuve = true): TestResponse
    {
        $vue ??= self::vue($test, $compte, $intervention);

        if ($preuve) {
            O::preuve($test);
        }

        return O::comme($test, $compte)->postJson(
            "/api/v1/owner/interventions/{$intervention}/approvals/{$demande}/decision",
            [...$vue, ...$corps],
            [...O::ORIGINE, ...($cle === null ? [] : ['Idempotency-Key' => $cle])],
        );
    }
}
