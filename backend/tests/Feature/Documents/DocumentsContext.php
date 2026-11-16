<?php

declare(strict_types=1);

namespace Tests\Feature\Documents;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\PublicApi\PlatformCatalog;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Parties\Models\Party;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Http\UploadedFile;

final class DocumentsContext
{
    public const PDF = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";

    public static function organisation(): Organization
    {
        $titulaire = User::factory()->create();
        activerDeuxFacteurs($titulaire);

        return app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, 'Agence du Port', 'FR'), 'Awa', 'Diallo');
    }

    public static function titulaire(Organization $organisation): User
    {
        return User::query()->findOrFail($organisation->created_by_user_id);
    }

    public static function membre(Organization $organisation, MemberRole $role): User
    {
        $compte = User::factory()->create();

        self::dans($organisation, fn (): OrganizationMember => OrganizationMember::query()->create([
            'user_id' => $compte->id,
            'email' => mb_strtolower($compte->email),
            'first_name' => 'Marc',
            'last_name' => 'Chevalier',
            'role' => $role,
            'status' => MemberStatus::Active,
            'joined_at' => now(),
        ]));

        return $compte;
    }

    public static function partie(Organization $organisation): string
    {
        return self::dans($organisation, fn (): string => Party::factory()->company()->create()->id);
    }

    public static function semer(): void
    {
        app(PlatformCatalog::class)->seed();
    }

    public static function type(string $cle): string
    {
        return Term::query()->whereNull('organization_id')->where('vocabulary', VocabularyKey::CertificateType->value)->where('key', $cle)->firstOrFail()->id;
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    public static function typePropre(Organization $organisation, string $cle, array $metadata): string
    {
        return Term::factory()->create([
            'organization_id' => $organisation->id,
            'vocabulary' => VocabularyKey::CertificateType->value,
            'key' => $cle,
            'labels' => ['fr' => 'Type '.$cle],
            'metadata' => $metadata,
        ])->id;
    }

    /**
     * @template T
     *
     * @param  Closure(): T  $appel
     * @return T
     */
    public static function dans(Organization $organisation, Closure $appel): mixed
    {
        return app(CurrentOrganization::class)->run($organisation->id, $appel);
    }

    public static function changerDeCompte(mixed $test, User $compte): mixed
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);

        return $test->actingAs($compte);
    }

    public static function url(Organization $organisation, string $chemin): string
    {
        return "/api/v1/org/{$organisation->id}/documents{$chemin}";
    }

    public static function pdf(string $nom = 'bail.pdf', string $contenu = self::PDF): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($nom, $contenu);
    }
}
