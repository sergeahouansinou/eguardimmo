<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Planning\Models\PlanningEvent;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Planning\PlanningContext as P;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->site = C::site($this->org);
    $this->lot = C::lot($this->org, $this->site);
    $this->actingAs($this->titulaire);
});

function creerEvenementApi(array $corps = []): array
{
    return test()->postJson(P::url(test()->org, '/events'), P::evenement($corps))->assertCreated()->json('data');
}

function occurrencesApi(string $from, string $to): array
{
    return test()->getJson(P::url(test()->org, "/events?from={$from}&to={$to}"))->assertOk()->json('data');
}

it('exige un jeton, la bonne organisation et, pour écrire, owner, admin ou manager', function (): void {
    $evenement = creerEvenementApi();
    $id = $evenement['id'];
    $lectures = [P::url($this->org, '/events?from=2026-12-01&to=2026-12-31'), P::url($this->org, "/events/{$id}")];
    $ecritures = [
        ['post', P::url($this->org, '/events'), P::evenement()],
        ['patch', P::url($this->org, "/events/{$id}"), ['lock_version' => 1, 'title' => 'Autre']],
        ['post', P::url($this->org, "/events/{$id}/cancel"), []],
    ];

    auth()->forgetGuards();
    foreach ($lectures as $url) {
        $this->getJson($url)->assertUnauthorized();
    }
    foreach ($ecritures as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertUnauthorized();
    }

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Accountant));
    foreach ($lectures as $url) {
        $this->getJson($url)->assertOk();
    }
    foreach ($ecritures as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    C::changerDeCompte($this, C::titulaire(C::organisation()));
    foreach ($lectures as $url) {
        $this->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
    foreach ($ecritures as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Manager));
    $this->postJson(P::url($this->org, '/events'), P::evenement())->assertCreated();
});

it('ne laisse jamais lire ni modifier l\'événement d\'une autre organisation', function (): void {
    $autre = C::organisation();
    $etranger = P::creerEvenement($autre);
    $url = P::url($this->org, "/events/{$etranger->id}");

    $this->getJson($url)->assertNotFound()->assertJsonPath('code', 'planning_event_not_found');
    $this->patchJson($url, ['lock_version' => 1, 'title' => 'Pirate'])->assertNotFound()->assertJsonPath('code', 'planning_event_not_found');
    $this->postJson("{$url}/cancel")->assertNotFound()->assertJsonPath('code', 'planning_event_not_found');
    $this->getJson(P::url($this->org, '/events/pas-un-uuid'))->assertNotFound();
    expect(C::dans($autre, fn (): ?PlanningEvent => PlanningEvent::query()->find($etranger->id)))->not->toBeNull();
    expect(C::dans($autre, fn (): ?string => PlanningEvent::query()->find($etranger->id)?->title))->not->toBe('Pirate');
});

it('crée un événement horodaté avec le fuseau de l\'organisation, sans rien accepter du serveur', function (): void {
    $donnees = creerEvenementApi(['notes' => 'Apporter le dossier', 'reminder_offset_minutes' => 60, 'organization_id' => (string) fake()->uuid(), 'created_by_user_id' => (string) fake()->uuid(), 'timezone' => 'Asia/Tokyo', 'next_reminder_at' => '2020-01-01 00:00:00']);

    expect($donnees)->toMatchArray([
        'kind' => 'appointment', 'title' => 'Rendez-vous syndic', 'starts_on' => '2026-12-01', 'start_time' => '10:00',
        'timezone' => 'Europe/Paris', 'all_day' => false, 'recurrence' => 'none', 'reminder_offset_minutes' => 60,
        'created_by_user_id' => $this->titulaire->id, 'cancelled_at' => null, 'lock_version' => 1, 'attendees' => [],
    ]);

    $ligne = C::dans($this->org, fn (): PlanningEvent => PlanningEvent::query()->findOrFail($donnees['id']));
    expect($ligne->organization_id)->toBe($this->org->id)
        ->and($ligne->next_reminder_at?->toIso8601ZuluString())->toBe('2026-12-01T08:00:00Z');
});

it('crée un événement sur la journée entière sans fuseau, rappelé à 08:00 locales la veille', function (): void {
    $donnees = creerEvenementApi(['start_time' => null, 'reminder_offset_minutes' => 1440, 'kind' => 'deadline']);

    expect($donnees['all_day'])->toBeTrue()->and($donnees['start_time'])->toBeNull()->and($donnees['timezone'])->toBeNull();
    expect(C::dans($this->org, fn () => PlanningEvent::query()->findOrFail($donnees['id'])->next_reminder_at?->toIso8601ZuluString()))->toBe('2026-11-30T07:00:00Z');
});

it('valide les champs en liste blanche et refuse le HTML', function (string $champ, mixed $valeur): void {
    $this->postJson(P::url($this->org, '/events'), P::evenement([$champ => $valeur]))->assertUnprocessable()->assertJsonValidationErrors([$champ]);
})->with([
    'type inconnu' => ['kind', 'intervention'],
    'titre vide' => ['title', ''],
    'titre trop long' => ['title', str_repeat('a', 121)],
    'titre HTML' => ['title', '<script>alert(1)</script>'],
    'notes HTML' => ['notes', 'a <b>b</b>'],
    'notes trop longues' => ['notes', str_repeat('a', 1001)],
    'date invalide' => ['starts_on', '01/12/2026'],
    'heure invalide' => ['start_time', '25:00'],
    'récurrence inconnue' => ['recurrence', 'daily'],
    'rappel hors liste' => ['reminder_offset_minutes', 30],
    'bien non UUID' => ['property_id', 'abc'],
]);

it('exige type, titre et date, et refuse une fin de récurrence incohérente', function (): void {
    $this->postJson(P::url($this->org, '/events'), [])->assertUnprocessable()->assertJsonValidationErrors(['kind', 'title', 'starts_on']);
    $this->postJson(P::url($this->org, '/events'), P::evenement(['recurrence_until' => '2027-01-01']))->assertUnprocessable()->assertJsonValidationErrors(['recurrence_until']);
    $this->postJson(P::url($this->org, '/events'), P::evenement(['recurrence' => 'weekly', 'recurrence_until' => '2026-11-30']))->assertUnprocessable()->assertJsonValidationErrors(['recurrence_until']);
});

it('vérifie le bien, le lot et le bail avec un seul code d\'erreur', function (): void {
    $bail = L::bail($this->org);
    R::occuper($this->org, $bail, $this->lot, ['valid_from' => '2026-01-01']);
    $autre = C::organisation();
    $autreLot = C::lot($autre, C::site($autre));
    $autreSite = C::site($autre);

    creerEvenementApi(['property_id' => $this->site->id]);
    $lie = creerEvenementApi(['unit_id' => $this->lot->id, 'lease_id' => $bail->id]);
    expect($lie['property_id'])->toBe($this->site->id)->and($lie['unit_id'])->toBe($this->lot->id)->and($lie['lease_id'])->toBe($bail->id);

    foreach ([['unit_id' => $autreLot->id], ['property_id' => $autreSite->id], ['lease_id' => (string) fake()->uuid()], ['property_id' => (string) fake()->uuid()]] as $liens) {
        $this->postJson(P::url($this->org, '/events'), P::evenement($liens))->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    }

    $autreBien = C::site($this->org);
    $this->postJson(P::url($this->org, '/events'), P::evenement(['property_id' => $autreBien->id, 'unit_id' => $this->lot->id]))->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
});

it('accepte des participants membres actifs et fiches de l\'organisation, 20 au plus', function (): void {
    $membre = C::membre($this->org, MemberRole::Manager);
    $partie = C::partie($this->org);
    $donnees = creerEvenementApi(['attendees' => [['user_id' => $membre->id], ['party_id' => $partie->id]]]);

    expect($donnees['attendees'])->toEqualCanonicalizing([['user_id' => $membre->id, 'party_id' => null], ['user_id' => null, 'party_id' => $partie->id]]);
    expect($this->getJson(P::url($this->org, "/events/{$donnees['id']}"))->assertOk()->json('data.attendees'))->toHaveCount(2);

    $etranger = C::membre(C::organisation(), MemberRole::Manager);
    $this->postJson(P::url($this->org, '/events'), P::evenement(['attendees' => [['user_id' => $etranger->id]]]))->assertUnprocessable()->assertJsonPath('code', 'planning_assignee_invalid');
    $this->postJson(P::url($this->org, '/events'), P::evenement(['attendees' => [['party_id' => C::partie(C::organisation())->id]]]))->assertUnprocessable();

    $trop = array_map(fn (): array => ['user_id' => (string) fake()->uuid()], range(1, 21));
    $this->postJson(P::url($this->org, '/events'), P::evenement(['attendees' => $trop]))->assertUnprocessable()->assertJsonValidationErrors(['attendees']);
    $this->postJson(P::url($this->org, '/events'), P::evenement(['attendees' => [['user_id' => $membre->id, 'party_id' => $partie->id]]]))->assertUnprocessable();
});

it('modifie l\'événement avec la version, refuse une version périmée et conserve le fuseau d\'origine', function (): void {
    $evenement = creerEvenementApi(['reminder_offset_minutes' => 60]);
    $url = P::url($this->org, "/events/{$evenement['id']}");
    C::dans($this->org, fn () => PlanningEvent::query()->whereKey($evenement['id'])->update(['timezone' => 'Europe/Brussels']));

    $modifie = $this->patchJson($url, ['lock_version' => 1, 'title' => 'Rendez-vous déplacé', 'start_time' => '14:30'])->assertOk()
        ->assertJsonPath('data.title', 'Rendez-vous déplacé')->assertJsonPath('data.start_time', '14:30')->assertJsonPath('data.lock_version', 2)
        ->assertJsonPath('data.timezone', 'Europe/Brussels')->json('data');
    expect($modifie['starts_on'])->toBe('2026-12-01');

    $this->patchJson($url, ['lock_version' => 1, 'title' => 'Périmé'])->assertConflict()->assertJsonPath('code', 'planning_version_conflict');
    $this->patchJson($url, ['title' => 'Sans version'])->assertUnprocessable()->assertJsonValidationErrors(['lock_version']);
    $this->patchJson($url, ['lock_version' => 2, 'start_time' => null])->assertOk()->assertJsonPath('data.timezone', null)->assertJsonPath('data.all_day', true);
});

it('annule sans supprimer, masque l\'événement de l\'agenda et le verrouille', function (): void {
    $evenement = creerEvenementApi();
    $url = P::url($this->org, "/events/{$evenement['id']}");
    expect(occurrencesApi('2026-12-01', '2026-12-02'))->toHaveCount(1);

    $this->postJson("{$url}/cancel")->assertOk()->assertJsonPath('data.lock_version', 2);
    expect($this->getJson($url)->assertOk()->json('data.cancelled_at'))->not->toBeNull();
    expect(occurrencesApi('2026-12-01', '2026-12-02'))->toBe([]);
    $this->patchJson($url, ['lock_version' => 2, 'title' => 'Tardif'])->assertConflict()->assertJsonPath('code', 'planning_event_cancelled');
    expect(C::dans($this->org, fn (): int => PlanningEvent::query()->count()))->toBe(1);
    expect(C::dans($this->org, fn () => PlanningEvent::query()->findOrFail($evenement['id'])->next_reminder_at))->toBeNull();
});

it('masque le titre et les notes dans le journal d\'audit', function (): void {
    $evenement = creerEvenementApi(['title' => 'Litige Dupont', 'notes' => 'Code porte secret']);
    $audit = json_encode(AuditLog::query()->where('subject_id', $evenement['id'])->get()->toArray(), JSON_THROW_ON_ERROR);

    expect($audit)->not->toContain('Litige Dupont')->and($audit)->not->toContain('Code porte');
    expect(AuditLog::query()->where('subject_id', $evenement['id'])->exists())->toBeTrue();
});

it('développe les occurrences hebdomadaires sur une période semi-ouverte', function (): void {
    creerEvenementApi(['starts_on' => '2026-12-01', 'recurrence' => 'weekly', 'recurrence_until' => '2026-12-22']);

    expect(array_column(occurrencesApi('2026-12-01', '2027-01-31'), 'occurrence_on'))->toBe(['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22']);
    expect(array_column(occurrencesApi('2026-12-02', '2026-12-15'), 'occurrence_on'))->toBe(['2026-12-08']);
    expect(array_column(occurrencesApi('2026-12-08', '2026-12-09'), 'occurrence_on'))->toBe(['2026-12-08']);
    expect(occurrencesApi('2026-12-23', '2027-01-31'))->toBe([]);
});

it('ramène une mensuelle du 31 et une annuelle du 29 février au dernier jour du mois', function (): void {
    creerEvenementApi(['title' => 'Mensuelle', 'starts_on' => '2026-01-31', 'recurrence' => 'monthly']);
    creerEvenementApi(['title' => 'Annuelle', 'starts_on' => '2024-02-29', 'recurrence' => 'yearly']);

    $mensuelles = fn (string $de, string $a): array => array_column(array_filter(occurrencesApi($de, $a), fn (array $o): bool => $o['title'] === 'Mensuelle'), 'occurrence_on');
    expect($mensuelles('2027-01-15', '2027-03-01'))->toBe(['2027-01-31', '2027-02-28'])->and($mensuelles('2027-03-15', '2027-05-01'))->toBe(['2027-03-31', '2027-04-30']);

    $annuelles = fn (string $de, string $a): array => array_column(array_filter(occurrencesApi($de, $a), fn (array $o): bool => $o['title'] === 'Annuelle'), 'occurrence_on');
    expect($annuelles('2027-02-01', '2027-03-31'))->toBe(['2027-02-28'])->and($annuelles('2028-02-01', '2028-03-31'))->toBe(['2028-02-29']);
});

it('calcule l\'instant UTC des occurrences autour des changements d\'heure de Paris', function (): void {
    creerEvenementApi(['title' => 'Hiver', 'starts_on' => '2027-03-27', 'recurrence' => 'weekly', 'start_time' => '09:00']);
    creerEvenementApi(['title' => 'Été', 'starts_on' => '2027-10-30', 'recurrence' => 'weekly', 'start_time' => '09:00']);
    creerEvenementApi(['title' => 'Inexistante', 'starts_on' => '2027-03-28', 'start_time' => '02:30']);

    $mars = collect(occurrencesApi('2027-03-27', '2027-04-04'))->keyBy(fn (array $o): string => $o['title'].$o['occurrence_on']);
    expect($mars['Hiver2027-03-27']['starts_at'])->toBe('2027-03-27T08:00:00Z')
        ->and($mars['Hiver2027-04-03']['starts_at'])->toBe('2027-04-03T07:00:00Z')
        ->and($mars['Inexistante2027-03-28']['starts_at'])->toBe('2027-03-28T01:30:00Z');

    $octobre = collect(occurrencesApi('2027-10-30', '2027-11-07'))->keyBy(fn (array $o): string => $o['title'].$o['occurrence_on']);
    expect($octobre['Été2027-10-30']['starts_at'])->toBe('2027-10-30T07:00:00Z')
        ->and($octobre['Été2027-11-06']['starts_at'])->toBe('2027-11-06T08:00:00Z');
});

it('refuse une période de plus de 62 jours ou de plus de 500 occurrences, sans tronquer', function (): void {
    $this->getJson(P::url($this->org, '/events?from=2026-12-01&to=2027-02-01'))->assertOk();
    $this->getJson(P::url($this->org, '/events?from=2026-12-01&to=2027-02-02'))->assertUnprocessable()->assertJsonPath('code', 'planning_range_too_wide');
    $this->getJson(P::url($this->org, '/events?from=2026-12-01&to=2026-12-01'))->assertUnprocessable()->assertJsonValidationErrors(['to']);
    $this->getJson(P::url($this->org, '/events?from=2026-12-01'))->assertUnprocessable()->assertJsonValidationErrors(['to']);

    $maintenant = now();
    $lignes = array_map(fn (int $i): array => [
        'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'kind' => 'reminder', 'title' => "Tous les jours {$i}",
        'starts_on' => '2026-12-01', 'recurrence' => 'weekly', 'created_by_user_id' => $this->titulaire->id, 'lock_version' => 1,
        'created_at' => $maintenant, 'updated_at' => $maintenant,
    ], range(1, 40));
    PlanningEvent::query()->withoutGlobalScopes()->insert($lignes);
    $this->getJson(P::url($this->org, '/events?from=2026-12-01&to=2027-01-31'))->assertOk();

    PlanningEvent::query()->withoutGlobalScopes()->insert(array_map(fn (array $l): array => [...$l, 'id' => (string) Str::uuid7(), 'title' => 'Bis '.$l['title']], $lignes));
    $this->getJson(P::url($this->org, '/events?from=2026-12-01&to=2027-01-31'))->assertUnprocessable()->assertJsonPath('code', 'planning_range_too_wide');
});

it('garde un nombre de requêtes constant quel que soit le nombre d\'événements', function (): void {
    $compter = function (): int {
        $n = 0;
        DB::listen(function () use (&$n): void {
            $n++;
        });
        $this->getJson(P::url($this->org, '/events?from=2026-12-01&to=2026-12-31'))->assertOk();

        return $n;
    };

    P::creerEvenement($this->org);
    $un = $compter();
    foreach (range(1, 20) as $_) {
        P::creerEvenement($this->org);
    }

    expect($compter())->toBe($un);
});
