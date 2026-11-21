<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Requests;

use App\Modules\Payments\Enums\OnlinePaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateOnlinePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Aucun montant : il est lu au grand livre.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'lease' => ['required', 'uuid'],
            'installments' => ['required', 'array', 'min:1', 'max:12'],
            'installments.*' => ['required', 'uuid', 'distinct'],
            'method' => ['required', 'string', Rule::enum(OnlinePaymentMethod::class)],
            'client_id' => ['required', 'uuid'],
        ];
    }

    /**
     * @return list<string>
     */
    public function installmentIds(): array
    {
        return array_values(array_map('strval', (array) $this->validated('installments')));
    }

    public function paymentMethod(): OnlinePaymentMethod
    {
        return OnlinePaymentMethod::from((string) $this->validated('method'));
    }
}
