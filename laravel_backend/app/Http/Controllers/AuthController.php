<?php

namespace App\Http\Controllers;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $user = User::whereRaw('LOWER(email) = ?', [strtolower($data['email'])])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return $this->fail('Invalid email or password', 401);
        }
        if (! $user->isActive) {
            return $this->fail('This account has been deactivated', 401);
        }

        $token = $user->createToken('customer', ['customer'])->plainTextToken;

        return $this->ok(['token' => $token, 'user' => $user]);
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'firstName' => ['required', 'string', 'max:100'],
            'lastName' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ], [
            'email.unique' => 'An account with this email already exists. Please log in instead.',
        ]);

        $now = Carbon::now('UTC');
        $user = new User([
            'firstName' => $data['firstName'],
            'lastName' => $data['lastName'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? '',
            'password' => $data['password'],
            'addresses' => [],
            'isActive' => true,
            'storeCredit' => 0,
        ]);
        $user->createdAt = $now;
        $user->updatedAt = $now;
        $user->save();

        return $this->ok($user, null, 201);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return $this->ok(['success' => true]);
    }

    public function user(Request $request)
    {
        return $this->ok($request->user());
    }

    public function updateUser(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'firstName' => ['sometimes', 'string', 'max:100'],
            'lastName' => ['sometimes', 'string', 'max:100'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'avatar' => ['sometimes', 'nullable', 'string'],
            'addresses' => ['sometimes', 'array'],
        ]);

        foreach (['firstName', 'lastName', 'phone', 'avatar', 'addresses'] as $field) {
            if (array_key_exists($field, $data)) {
                $user->{$field} = $data[$field];
            }
        }
        $user->updatedAt = Carbon::now('UTC');
        $user->save();

        return $this->ok($user);
    }

    public function changePassword(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return $this->fail('The given data was invalid.', 422, [
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->password = $data['password'];
        $user->updatedAt = Carbon::now('UTC');
        $user->save();

        return $this->ok(['success' => true]);
    }
}
