<?php

declare(strict_types=1);

namespace Tests\Feature\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Support\IssuerIdentity;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tenant\TenantContext as T;

final class TenantRentContext
{
    public const string URL = '/api/v1/tenant/rent';

    /**
     * Un locataire rattaché à un bail signé dont l'échéance du mois est émise (avis PDF compris) ; la session est celle de l'organisation.
     *
     * @param  array<string, mixed>  $bail
     * @return array{user: User, party: Party, lease: Lease, installment: Installment}
     */
    public static function facture(object $test, Organization $organisation, array $bail = [], ?User $compte = null): array
    {
        self::repartir($test, null);
        $moi = T::locataire($organisation, $bail, [], $compte);
        [$echeance] = C::emises($organisation, $moi['lease'], $test);

        return ['user' => $moi['user'], 'party' => $moi['party'], 'lease' => $moi['lease'], 'installment' => $echeance];
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function encaisser(object $test, Organization $organisation, Lease $bail, int $montant, array $surcharges = []): TestResponse
    {
        self::repartir($test, L::titulaire($organisation));

        return C::payer($test, $organisation, $bail, $montant, $surcharges)->assertCreated();
    }

    /**
     * L'émetteur des pièces garde l'organisation courante : une nouvelle session de test doit le recréer.
     */
    private static function repartir(object $test, ?User $compte): void
    {
        app()->forgetInstance(IssuerIdentity::class);
        T::comme($test, $compte);
    }

    public static function rattacher(Organization $organisation, Party $partie, User $compte): void
    {
        L::dans($organisation, fn (): bool => $partie->forceFill(['user_id' => $compte->id])->save());
    }

    /**
     * @param  list<string>  $mots
     */
    public static function absents(TestResponse $reponse, array $mots): void
    {
        $corps = (string) $reponse->getContent();

        foreach ($mots as $mot) {
            expect($corps)->not->toContain($mot);
        }
    }
}
