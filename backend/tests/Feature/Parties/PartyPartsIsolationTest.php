<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Parties\PartiesContext as C;

const ISOLATION_IBAN = 'FR7630006000011234567890189';
const ISOLATION_IBAN_2 = 'GB82WEST12345698765432';

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->fiche = C::partie($this->org);
    $this->autreFiche = C::partie($this->org);
    $this->actingAs(C::titulaire($this->org));
    $this->urlFiche = C::url($this->org, "/{$this->fiche->id}");
    $this->urlAutreFiche = C::url($this->org, "/{$this->autreFiche->id}");
});

function isolationSousObjets(mixed $test, string $urlFiche): array
{
    return [
        'contact' => $test->postJson("{$urlFiche}/contact-points", ['type' => 'email', 'value' => 'a@exemple.fr'])->assertCreated()->json('data.id'),
        'identifiant' => $test->postJson("{$urlFiche}/identifiers", ['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789'])->assertCreated()->json('data.id'),
        'compte' => $test->postJson("{$urlFiche}/bank-accounts", ['iban' => ISOLATION_IBAN, 'holder_name' => 'Jean Dupont', 'valid_from' => '2026-01-01'])->assertCreated()->json('data.id'),
    ];
}

it('renvoie 404 pour un sous-objet d\'une autre fiche de la même organisation, sans le modifier', function (): void {
    $ids = isolationSousObjets($this, $this->urlAutreFiche);
    $avant = [
        DB::table('contact_points')->where('id', $ids['contact'])->first(),
        DB::table('party_identifiers')->where('id', $ids['identifiant'])->first(),
        DB::table('bank_accounts')->where('id', $ids['compte'])->first(),
    ];

    $this->patchJson("{$this->urlFiche}/contact-points/{$ids['contact']}", ['label' => 'Pirate'])->assertNotFound()->assertJsonPath('code', 'contact_point_not_found');
    $this->patchJson("{$this->urlFiche}/identifiers/{$ids['identifiant']}", ['value' => '111222333'])->assertNotFound()->assertJsonPath('code', 'identifier_not_found');
    $this->postJson("{$this->urlFiche}/bank-accounts/{$ids['compte']}/replacement", ['iban' => ISOLATION_IBAN_2, 'holder_name' => 'Pirate', 'valid_from' => '2026-06-01'])
        ->assertNotFound()->assertJsonPath('code', 'bank_account_not_found');

    expect(DB::table('contact_points')->where('id', $ids['contact'])->first())->toEqual($avant[0])
        ->and(DB::table('party_identifiers')->where('id', $ids['identifiant'])->first())->toEqual($avant[1])
        ->and(DB::table('bank_accounts')->where('id', $ids['compte'])->first())->toEqual($avant[2])
        ->and(DB::table('bank_accounts')->count())->toBe(1);
});

it('renvoie 404 pour un sous-objet ou une fiche d\'une autre organisation passés dans l\'URL de la sienne', function (): void {
    $autreOrg = C::organisation();
    $ficheEtrangere = C::partie($autreOrg);
    $urlEtrangere = C::url($autreOrg, "/{$ficheEtrangere->id}");

    C::changerDeCompte($this, C::titulaire($autreOrg));
    $ids = isolationSousObjets($this, $urlEtrangere);
    $avant = DB::table('contact_points')->where('id', $ids['contact'])->first();

    C::changerDeCompte($this, C::titulaire($this->org));

    $this->patchJson("{$this->urlFiche}/contact-points/{$ids['contact']}", ['label' => 'Pirate'])->assertNotFound()->assertJsonPath('code', 'contact_point_not_found');
    $this->patchJson("{$this->urlFiche}/identifiers/{$ids['identifiant']}", ['value' => '111222333'])->assertNotFound()->assertJsonPath('code', 'identifier_not_found');
    $this->postJson("{$this->urlFiche}/bank-accounts/{$ids['compte']}/replacement", ['iban' => ISOLATION_IBAN_2, 'holder_name' => 'Pirate', 'valid_from' => '2026-06-01'])
        ->assertNotFound()->assertJsonPath('code', 'bank_account_not_found');

    $this->patchJson("{$urlEtrangere}/contact-points/{$ids['contact']}", ['label' => 'Pirate'])->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    $this->getJson($urlEtrangere)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    $this->patchJson(C::url($this->org, "/{$ficheEtrangere->id}/contact-points/{$ids['contact']}"), ['label' => 'Pirate'])->assertNotFound()->assertJsonPath('code', 'party_not_found');

    expect(DB::table('contact_points')->where('id', $ids['contact'])->first())->toEqual($avant)
        ->and(DB::table('bank_accounts')->count())->toBe(1);
});

it('modifie bien un sous-objet de la bonne fiche', function (): void {
    $ids = isolationSousObjets($this, $this->urlFiche);

    $this->patchJson("{$this->urlFiche}/contact-points/{$ids['contact']}", ['label' => 'Perso'])->assertOk()->assertJsonPath('data.label', 'Perso');
    $this->patchJson("{$this->urlFiche}/identifiers/{$ids['identifiant']}", ['value' => '111222333'])->assertOk();
    $this->postJson("{$this->urlFiche}/bank-accounts/{$ids['compte']}/replacement", ['iban' => ISOLATION_IBAN_2, 'holder_name' => 'Jean Dupont', 'valid_from' => '2026-06-01'])->assertCreated();
});
