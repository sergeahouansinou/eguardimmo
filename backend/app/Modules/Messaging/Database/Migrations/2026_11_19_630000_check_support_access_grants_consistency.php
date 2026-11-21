<?php

declare(strict_types=1);

use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const array CONTRAINTES = ['scopes_present', 'live_organization', 'emergency_basis_kind'];

    public function up(): void
    {
        Checks::add('support_access_grants', 'scopes_present', '(organization_id IS NULL OR (scopes IS NOT NULL AND JSON_LENGTH(scopes) > 0))');
        Checks::add('support_access_grants', 'live_organization', "(status NOT IN ('requested', 'active') OR organization_id IS NOT NULL)");
        Checks::add('support_access_grants', 'emergency_basis_kind', "((kind = 'emergency' AND emergency_basis IS NOT NULL) OR (kind <> 'emergency' AND emergency_basis IS NULL))");
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            foreach (self::CONTRAINTES as $contrainte) {
                DB::statement("ALTER TABLE support_access_grants DROP CONSTRAINT support_access_grants_{$contrainte}_check");
            }
        }
    }
};
