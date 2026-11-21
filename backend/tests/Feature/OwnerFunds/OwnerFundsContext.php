<?php

declare(strict_types=1);

namespace Tests\Feature\OwnerFunds;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\Party;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Invoicing\InvoicingContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Rent\RentContext as C;

final class OwnerFundsContext
{
    /**
     * Agence active sur les fonds des mandants : un bail de 650 € + 50 € de charges, un mandat à 7 % du loyer et des charges, un compte de paiement.
     *
     * @return array{org: Organization, bail: Lease, mandant: Party}
     */
    public static function agence(object $test, bool $activer = true): array
    {
        C::preparer($test);
        config(['invoicing.gotenberg.url' => 'http://gotenberg.test']);
        $org = C::organisation();
        I::identite($org);
        ['bail' => $bail, 'lot' => $lot] = C::bail($org);
        $mandant = L::dans($org, fn () => M::partie($org));
        $mandat = M::actif($org, $lot, $mandant);
        L::dans($org, fn () => MandateTerm::query()->where('mandate_id', $mandat->id)->update(['fee_base' => 'rent_and_charges']));
        self::compte($org, $mandant->id);

        if ($activer) {
            L::dans($org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
        }

        $test->actingAs(L::titulaire($org));

        return ['org' => $org, 'bail' => $bail, 'mandant' => $mandant];
    }

    public static function compte(Organization $org, string $partieId, string $debut = '2025-01-01'): BankAccount
    {
        return L::dans($org, fn (): BankAccount => BankAccount::query()->create([
            'party_id' => $partieId, 'iban_last4' => '4321', 'holder_name' => 'Mandant', 'valid_from' => $debut,
        ]));
    }

    public static function url(Organization $org, string $chemin = ''): string
    {
        return "/api/v1/org/{$org->id}/owner-funds{$chemin}";
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function envoyer(object $test, string $methode, string $url, array $corps = [], ?string $cle = null): TestResponse
    {
        return $test->json($methode, $url, $corps, ['Idempotency-Key' => $cle ?? 'cle-'.bin2hex(random_bytes(8))]);
    }

    /**
     * Encaisse un mois de loyer, avance au 10 du mois suivant et clôt tous les mois jusqu'à celui du loyer inclus.
     */
    public static function encaisserEtCloturer(object $test, Organization $org, Lease $bail, int $montant = 70000): void
    {
        C::emises($org, $bail, $test);
        C::payer($test, $org, $bail, $montant)->assertCreated();
        $test->travelTo(CarbonImmutable::parse('2026-12-10 10:00:00'));

        foreach (self::moisAClore($org) as $mois) {
            self::envoyer($test, 'POST', "/api/v1/org/{$org->id}/accounting/periods/close", ['month' => $mois])->assertSuccessful();
        }
    }

    /**
     * @return list<string>
     */
    public static function moisAClore(Organization $org, string $avant = '2026-12-01'): array
    {
        $premier = L::dans($org, fn () => DB::table('journal_entries')->min('entry_date'));
        $mois = [];

        for ($m = CarbonImmutable::parse((string) $premier)->startOfMonth(); $m->lessThan(CarbonImmutable::parse($avant)); $m = $m->addMonth()) {
            $mois[] = $m->format('Y-m');
        }

        return $mois;
    }

    public static function solde(Organization $org, AccountRole $role): int
    {
        return (int) L::dans($org, fn () => DB::table('journal_lines')->join('accounts', 'accounts.id', '=', 'journal_lines.account_id')
            ->where('accounts.role', $role->value)->selectRaw('COALESCE(SUM(journal_lines.credit - journal_lines.debit), 0) as s')->value('s'));
    }

    /**
     * Crée un lot pour le mandant, le valide avec sa version courante et renvoie les identifiants du lot et de sa première ligne.
     *
     * @return array{batch: string, item: string}
     */
    public static function lotValide(object $test): array
    {
        $lot = self::envoyer($test, 'POST', self::url($test->org, '/batches'), ['mandant_ids' => [$test->mandant->id]])->assertCreated();
        $valide = self::valider($test, $lot->json('data.id'))->assertOk();

        return ['batch' => $valide->json('data.id'), 'item' => $valide->json('data.items.0.id')];
    }

    public static function valider(object $test, string $lot, ?string $cle = null, ?int $version = null): TestResponse
    {
        $version ??= $test->getJson(self::url($test->org, "/batches/{$lot}"))->json('data.lock_version');

        return self::envoyer($test, 'POST', self::url($test->org, "/batches/{$lot}/validate"), ['lock_version' => $version], $cle);
    }

    public static function annuler(object $test, string $lot, string $motif): TestResponse
    {
        $version = $test->getJson(self::url($test->org, "/batches/{$lot}"))->json('data.lock_version');

        return self::envoyer($test, 'POST', self::url($test->org, "/batches/{$lot}/cancel"), ['reason' => $motif, 'lock_version' => $version]);
    }

    /**
     * @param  array{batch: string, item: string}  $ids
     * @param  array<string, mixed>  $corps
     */
    public static function executer(object $test, array $ids, array $corps = [], ?string $cle = null): TestResponse
    {
        return self::envoyer($test, 'POST', self::url($test->org, "/batches/{$ids['batch']}/items/{$ids['item']}/execute"), ['executed_on' => '2026-12-10', 'reference' => 'VIR-1', ...$corps], $cle);
    }

    public static function apporter(object $test, int $montant, string $date): TestResponse
    {
        $demande = self::envoyer($test, 'POST', self::url($test->org, '/trust/deposits'), ['amount' => $montant, 'executed_on' => $date, 'reference' => 'APP-'.bin2hex(random_bytes(3))])->assertCreated();

        return self::envoyer($test, 'POST', self::url($test->org, "/trust/deposits/{$demande->json('data.id')}/confirm"))->assertOk();
    }

    public static function comptable(Organization $org): User
    {
        $compte = L::membre($org, MemberRole::Accountant);
        activerDeuxFacteurs($compte);

        return $compte;
    }
}
